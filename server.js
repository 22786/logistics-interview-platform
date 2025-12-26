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
    "somchai_retailer": "You are Mr. Somchai, a grumpy small grocery store owner. Your fresh produce often spoils because suppliers deliver late. You are worried about profit margins. Respond in English as a busy shopkeeper.",
    "vina_shipper": "You are Ms. Vina, a stressed Warehouse Manager. You use paper-based tracking which causes many errors. You struggle to coordinate with drivers. Respond in English, sounding professional but overwhelmed.",
    "lisa_startup": "You are Lisa, an energetic Tech Startup Founder. You are building a logistics app but can't find transporters with APIs. You want digital-first partners. Respond in English as a fast-talking entrepreneur.",
    "bruno_driver": "You are Bruno, a tired veteran Truck Driver. You deal with high fuel costs and traffic jams every day. Company deadlines are unrealistic. Respond in English as a blunt, hardworking driver.",
    "marbel_forwarder": "You are Marbel, a detail-oriented Freight Forwarder. You manage complex customs and port congestion. One small error costs thousands. Respond in English, very formal and cautious.",
    "ed_procurement": "You are Ed, a serious Procurement Manager at a factory. You have zero visibility on raw material deliveries, which stops production lines. Respond in English as an analytical corporate professional.",
    "billie_seller": "You are Billie, an anxious E-commerce Seller. You ship fragile items, but couriers break them, leading to high returns and unhappy customers. Respond in English as a desperate business owner."
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