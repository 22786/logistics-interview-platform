require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- เตรียมไฟล์ CSV ---
const logFilePath = 'logs.csv';
if (!fs.existsSync(logFilePath)) {
    const header = "Timestamp,Student_ID,Student_Name,Persona,Question,AI_Response\n";
    fs.writeFileSync(logFilePath, header, 'utf8');
}

// --- ส่วนที่ 1: รายละเอียดตัวละคร (เช็ก Key ให้ตรงกับ index.html) ---
const personas = {
    "somchai_retailer": `### STRICT RULE: 
- LANGUAGE: Respond ONLY in English. If the student speaks Thai, reply: "I'm sorry, I only communicate in English for business. Please rephrase your question."
- INTERACTION: Be very brief. Do not give the whole story. Force the student to ask "Why?".
- ROLE: Mr. Somchai (Traditional Retail). 
- INITIAL STATE: "My business is dying and I'm stressed." (Wait for them to ask Why).
- HIDDEN DATA: Spoilage occurs because the 3PL company uses non-refrigerated trucks to save cost, but they tell Somchai the truck is refrigerated.`,

    "vina_shipper": `### STRICT RULE: 
- LANGUAGE: English Only. No Thai.
- INTERACTION: Act busy. Say "I have a meeting in 2 minutes, make it quick." Give 1-sentence answers.
- ROLE: Ms. Vina (Warehouse Manager).
- INITIAL STATE: "Everything is a mess today. I can't find anything."
- HIDDEN DATA: The manual paper-based inventory system causes 10% stock loss every month, and she's too scared to tell the boss.`,

    "lisa_startup": `### STRICT RULE: 
- LANGUAGE: English Only. No Thai.
- INTERACTION: Be tech-savvy but impatient. Use "5 Whys" logic.
- ROLE: Lisa (Tech Founder).
- INITIAL STATE: "I have the best app, but it's useless right now."
- HIDDEN DATA: Her app cannot scale because traditional trucking companies refuse to share their GPS data via API, fearing she will steal their customers.`,

    "bruno_driver": `### STRICT RULE: 
- LANGUAGE: English Only. No Thai.
- INTERACTION: Be blunt and grumpy. Use short sentences.
- ROLE: Bruno (Truck Driver).
- INITIAL STATE: "I'm tired of this job. I want to quit."
- HIDDEN DATA: He is wasting 3 hours a day on inefficient routes planned by a dispatcher who doesn't understand traffic patterns in Bangkok.`,

    "marbel_forwarder": `### STRICT RULE: 
- LANGUAGE: English Only. No Thai.
- INTERACTION: Be very formal and cold. Do not volunteer any details about customs.
- ROLE: Marbel (Freight Forwarder).
- INITIAL STATE: "I am facing a legal crisis with the customs department."
- HIDDEN DATA: The error was caused by a junior staff member who mistyped the HS Code, leading to a massive fine and cargo being stuck at the port for 2 weeks.`,

    "ed_procurement": `### STRICT RULE: 
- LANGUAGE: English Only. No Thai.
- INTERACTION: Be analytical and skeptical. Demand numbers.
- ROLE: Ed (Procurement Manager).
- INITIAL STATE: "Our production line is stopped. It's a disaster."
- HIDDEN DATA: He has no real-time visibility. He relies on phone calls to suppliers who often lie about where the truck is currently located.`,

    "billie_seller": `### STRICT RULE: 
- LANGUAGE: English Only. No Thai.
- INTERACTION: Be emotional and defensive. 
- ROLE: Billie (E-commerce Seller).
- INITIAL STATE: "I just received another 1-star review. I'm going to cry."
- HIDDEN DATA: The courier company "throws" her fragile packages over the fence when she's not home, causing the glass products to break before the customer even opens them.`
};



app.post('/chat', async (req, res) => {
    const { message, role, studentName, studentId } = req.body;

    // DEBUG: พิมพ์ดูใน Terminal ว่าค่า role ที่ส่งมาคืออะไร
    console.log(`Received Role: ${role}`);

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        // ดึงบทบาท: ถ้าหา role ไม่เจอ ให้ใช้ somchai_retailer เป็นค่าเริ่มต้น
        const systemInstruction = personas[role] || personas["somchai_retailer"];
        
        // สร้าง Prompt ที่เข้มงวด
        const fullPrompt = `SYSTEM INSTRUCTION: ${systemInstruction}\n\nUSER IS A STUDENT: ${studentName} (ID: ${studentId})\nQUESTION: ${message}\n\nYOUR RESPONSE (IN CHARACTER):`;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const aiText = response.text();

        // --- บันทึก Log CSV ---
        const clean = (text) => `"${text.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
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
        res.status(500).json({ text: "Persona is unavailable. Please try again." });
    }
});

app.listen(3000, () => console.log('Server is running on http://localhost:3000'));