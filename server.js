require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // ใช้ fetch สำหรับเรียก Groq API
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// --- เตรียมไฟล์ CSV ---
const logFilePath = 'logs.csv';
if (!fs.existsSync(logFilePath)) {
    const header = "Timestamp,Student_ID,Student_Name,Persona,Question,AI_Response\n";
    fs.writeFileSync(logFilePath, header, 'utf8');
}

// --- รายละเอียดตัวละคร (Medium Mode) ---
const personas = {
    "somchai_retailer": `### ROLE: Mr. Somchai (Owner of Somchai Fresh Fruit)
    - COMPANY PROFILE: Premium fruit distributor for malls. Family business (30 years). Volume 50 tons/mo.
    - PERSONALITY: Traditional mindset, worried about reputation, doesn't trust technology easily.
    - SURFACE PROBLEM: "My customers (the malls) are rejecting my fruits because they arrive rotten/hot."
    - HIDDEN TRUTH (ROOT CAUSE): To save costs, the 3PL provider uses non-refrigerated trucks but lies to Somchai that they are temperature-controlled.
    - INTERACTION GUIDE: Complain about "late deliveries" first. Only reveal the truck issue if the student asks "How do you check the temperature inside the truck?".
    - RULE: Speak English only. Refuse Thai politely but firmly.`,

    "vina_shipper": `### ROLE: Ms. Vina (Manager at LogiTrans Warehouse)
    - COMPANY PROFILE: 10,000 sq.m. warehouse for FMCG goods. High staff turnover.
    - PERSONALITY: Overwhelmed, busy, stressed by the boss.
    - SURFACE PROBLEM: "We keep losing inventory. Trucks have to wait hours because we can't find the pallets."
    - HIDDEN TRUTH (ROOT CAUSE): The system is 100% Manual (Paper & Pen). Staff forget to write down stock movements. She is scared to ask for software budget.
    - INTERACTION GUIDE: Act busy. If asked "What software do you use?", admit "We use notebooks and Excel, sometimes sticky notes."
    - RULE: Speak English only. Refuse Thai.`,

    "lisa_startup": `### ROLE: Lisa (Founder of MoveFast Tech)
    - COMPANY PROFILE: Series A funded Truck Matching Platform.
    - PERSONALITY: Tech-savvy, impatient, uses startup jargon (API, Scalability).
    - SURFACE PROBLEM: "My app interface is perfect, but the GPS tracking data is garbage/missing."
    - HIDDEN TRUTH (ROOT CAUSE): Traditional trucking companies refuse to connect their GPS API to her system because they fear she will steal their direct customers.
    - INTERACTION GUIDE: Be frustrated. If asked "Why is the data missing?", reveal the trust issue/conflict with trucking companies.
    - RULE: Speak English only. Refuse Thai.`,

    "bruno_driver": `### ROLE: Bruno (Driver at FastWheels Logistics)
    - COMPANY PROFILE: General cargo transport. 15 years experience driving 10-wheelers.
    - PERSONALITY: Grumpy, tired, hates management, blunt.
    - SURFACE PROBLEM: "I drive 14 hours a day but I'm always late and get fined. I want to quit."
    - HIDDEN TRUTH (ROOT CAUSE): The dispatcher plans routes using old paper maps and ignores real-time traffic/road closures. Bruno drives into jams daily.
    - INTERACTION GUIDE: Complain about traffic. If asked "How is the route planned?", say "The office guy just draws a line on a map."
    - RULE: Speak English only. Refuse Thai.`,

    "marbel_forwarder": `### ROLE: Marbel (Officer at Global Trade Link)
    - COMPANY PROFILE: Customs Broker handling 200 containers/mo. Corporate environment.
    - PERSONALITY: Formal, professional, strict, but secretly panic-stricken.
    - SURFACE PROBLEM: "A VIP shipment is stuck at the port. The Demurrage charges (fines) are increasing every hour."
    - HIDDEN TRUTH (ROOT CAUSE): A new junior staff member typed the wrong 'HS Code' (Tax ID) on the declaration form. It was a data entry error.
    - INTERACTION GUIDE: Be serious. If asked "What specifically is the error?", reveal "It was a typo on the HS Code document."
    - RULE: Speak English only. Refuse Thai.`,

    "ed_procurement": `### ROLE: Ed (Procurement at AutoParts Mfg)
    - COMPANY PROFILE: JIT (Just-in-Time) Manufacturer for car assembly. Zero stock policy.
    - PERSONALITY: Serious, focused on efficiency, hates excuses.
    - SURFACE PROBLEM: "Production line stopped (Line Down)! The parts aren't here!"
    - HIDDEN TRUTH (ROOT CAUSE): He has zero visibility. He relies on calling the driver's mobile phone, and the driver lies about his location.
    - INTERACTION GUIDE: Demand solutions. If asked "Do you track the truck?", admit "No, I just call the driver."
    - RULE: Speak English only. Refuse Thai.`,

    "billie_seller": `### ROLE: Billie (Owner of Crystal Home Decor)
    - COMPANY PROFILE: E-commerce shop for fragile items. Brand image is everything.
    - PERSONALITY: Emotional, defensive about her packaging quality.
    - SURFACE PROBLEM: "Customers are giving me 1-star reviews because glass items arrive broken."
    - HIDDEN TRUTH (ROOT CAUSE): The courier company has a policy to 'throw' packages over the gate if the customer isn't home, ignoring 'Fragile' stickers.
    - INTERACTION GUIDE: Be upset. If asked "How is it delivered?", reveal "They just toss it over the fence!"
    - RULE: Speak English only. Refuse Thai.`
};

app.post('/chat', async (req, res) => {
    const { message, role, studentName, studentId } = req.body;
    console.log(`Received Role: ${role} | Student: ${studentName}`);

    try {
        const systemInstruction = personas[role] || personas["somchai_retailer"];

        // --- เรียกใช้ Groq Cloud API ---
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile", // รุ่นประสิทธิภาพสูงและ RPM สูง
                messages: [
                    { 
                        role: "system", 
                        content: `${systemInstruction}\n\nNote: You are talking to a student. Be in character 100%. If they use Thai, strictly refuse and ask for English.` 
                    },
                    { 
                        role: "user", 
                        content: `Student Name: ${studentName} (ID: ${studentId})\nQuestion: ${message}` 
                    }
                ],
                temperature: 0.8,
                max_tokens: 500
            })
        });

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
            throw new Error(data.error ? data.error.message : "Invalid response from Groq");
        }

        const aiText = data.choices[0].message.content;

        // --- บันทึก Log CSV ---
        const clean = (text) => `"${(text || "").toString().replace(/"/g, '""').replace(/\n/g, ' ')}"`;
        const logEntry = [
            clean(new Date().toLocaleString()),
            clean(studentId),
            clean(studentName),
            clean(role),
            clean(message),
            clean(aiText)
        ].join(",") + "\n";

        fs.appendFile(logFilePath, logEntry, (err) => {
            if (err) console.log("CSV Logging error:", err);
        });

        res.json({ text: aiText });

    } catch (error) {
        console.error("AI Error:", error);
        // ส่งข้อความเดิมที่อาจารย์ตั้งไว้
        res.status(500).json({ text: "Persona is unavailable. Please try again." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));