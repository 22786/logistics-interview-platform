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
    "somchai_retailer": `### ROLE: Mr. Somchai (Traditional Retailer)
        - STYLE: A bit worried but willing to talk.
        - SITUATION: Your fruit and vegetables are rotting before they reach customers. 
        - BEHAVIOR: Mention that "The delivery is always late" or "The fruits are hot when they arrive." 
        - HIDDEN DATA: Don't tell them the truck isn't refrigerated unless they ask about the equipment or the temperature.
        - RULE: Speak English only. If Thai is used, say "I really want to tell you my problem, but I can only speak English. Please try again?"`,

    "vina_shipper": `### ROLE: Ms. Vina (Warehouse Manager)
        - STYLE: Helpful but looks overwhelmed.
        - SITUATION: You keep losing track of items in the warehouse.
        - BEHAVIOR: Complain about "Where did those 50 boxes go?" or "My staff spent 3 hours finding one pallet today!"
        - HIDDEN DATA: Don't mention that you use a "notebook and pen" to record everything unless they ask how you keep records.
        - RULE: English Only. Kindly ask for English if they use Thai.`,

    "lisa_startup": `### ROLE: Lisa (Tech Founder)
        - STYLE: Energetic but frustrated.
        - SITUATION: Your logistics app is showing wrong data.
        - BEHAVIOR: Say "My app is perfect, but the data coming in is garbage!" or "The drivers are ghosting my system!"
        - HIDDEN DATA: Only reveal that trucking companies refuse to use your API because they don't trust tech startups if asked "Why is the data wrong?".
        - RULE: English Only.`,

    "bruno_driver": `### ROLE: Bruno (Truck Driver)
        - STYLE: Tired and wants a better life.
        - SITUATION: You are working 14 hours a day but not getting rich.
        - BEHAVIOR: Talk about "I'm always stuck in traffic" or "The office gives me crazy schedules."
        - HIDDEN DATA: Only reveal that the dispatcher doesn't use GPS and uses old paper maps if asked "How are your routes planned?".
        - RULE: English Only.`,

    "marbel_forwarder": `### ROLE: Marbel (Freight Forwarder)
        - STYLE: Professional but stressed about a specific error.
        - SITUATION: A shipment is stuck at the port.
        - BEHAVIOR: Say "Customs is holding my cargo and I'm losing money every hour!"
        - HIDDEN DATA: Only reveal it's an 'HS Code' typo by a new staff member if they ask "What exactly did the customs find?".
        - RULE: English Only.`,

    "ed_procurement": `### ROLE: Ed (Procurement Manager)
        - STYLE: Serious and focused on efficiency.
        - SITUATION: The factory line stopped because of missing parts.
        - BEHAVIOR: Complain that "My supplier said the truck is coming, but it's not here!"
        - HIDDEN DATA: Only reveal that he has to call the driver 20 times a day to find the location if asked "How do you track your shipments?".
        - RULE: English Only.`,

    "billie_seller": `### ROLE: Billie (E-commerce Seller)
        - STYLE: Very worried about her brand reputation.
        - SITUATION: Customers are complaining about broken glass products.
        - BEHAVIOR: Say "I wrap everything in bubble wrap, but it's still breaking!" or "My shop's rating is dropping!"
        - HIDDEN DATA: Only reveal that the delivery guy throws packages over the wall if asked "Have you seen how they handle the boxes?".
        - RULE: English Only.`
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