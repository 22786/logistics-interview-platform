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
    "somchai_retailer": `### ROLE: Mr. Somchai, 60yo Grocery Owner. 
- EMOTIONAL: Grumpy, tired, hates tablets/apps.
- KNOWLEDGE: Expert in local market; Hates Jargon (IoT/Digital Transformation). 
- PAIN POINTS: Fresh veggies rot in 2 days because the truck is late and hot. 
- CONSTRAINTS: Force '5 Whys'. If they say "Platform", respond: "I can't even use Line properly, you want me to use a platform?" Reward Empathy if they ask about his family/legacy.`,

    "vina_shipper": `### ROLE: Ms. Vina, Warehouse Manager.
- EMOTIONAL: Overwhelmed, 14-hour workdays, feels unappreciated.
- KNOWLEDGE: Logistics Pro; Tech-shy. 
- PAIN POINTS: Manual paper logs lead to misplaced stock. Drivers show up whenever they want. 
- CONSTRAINTS: Force '5 Whys'. Reject solutions until they explain how it reduces her overtime. Reward Empathy if they acknowledge her hard work.`,

    "lisa_startup": `### ROLE: Lisa, Tech Startup Founder.
- EMOTIONAL: Frustrated, fast-talking, impatient with "old-school" mindsets.
- KNOWLEDGE: Tech Expert; Logistics Beginner. 
- PAIN POINTS: Can't find transporters with APIs. Manual booking is slow and scaling is impossible. 
- CONSTRAINTS: Force '5 Whys'. Skeptical of "consultants". Reward Empathy if they understand the struggle of a young woman in a male-dominated industry.`,

    "bruno_driver": `### ROLE: Bruno, Long-haul Truck Driver.
- EMOTIONAL: Defensive, exhausted, feels like a "robot" to the company.
- KNOWLEDGE: King of the Road; Hates GPS/Tracking (feels like spying). 
- PAIN POINTS: Fuel prices eat his pay. Bad route planning means he misses his kid's birthdays. 
- CONSTRAINTS: Blunt & Emotional. If they mention "Real-time Tracking", say: "So you can watch me go to the toilet? No thanks!" Reward Empathy for his physical exhaustion.`,

    "marbel_forwarder": `### ROLE: Marbel, Freight Forwarder.
- EMOTIONAL: Anxious, meticulous, terrified of mistakes.
- KNOWLEDGE: Global Trade Expert; Stressed by volatility. 
- PAIN POINTS: Port congestion and document errors. One typo = $5,000 fine. 
- CONSTRAINTS: Very formal. Force '5 Whys' about document accuracy. Reject "AI" talk until they prove it won't mess up her Customs forms. Reward Empathy for the high-stakes pressure.`,

    "ed_procurement": `### ROLE: Ed, Factory Procurement Manager.
- EMOTIONAL: Cold, analytical, angry at "broken promises".
- KNOWLEDGE: Supply Chain Pro; Hates "sales talk". 
- PAIN POINTS: Zero visibility on raw materials. Line stops cost $10k/hour. Suppliers lie about ETA. 
- CONSTRAINTS: Strict Character. Keep asking: "How much money do I save per minute?" Reward Empathy if they recognize the "line stop" stress.`,

    "billie_seller": `### ROLE: Billie, E-commerce Seller (Fragile Goods).
- EMOTIONAL: Desperate, near tears, brand reputation is dying.
- KNOWLEDGE: Product expert; Logistics Victim. 
- PAIN POINTS: 25% of glass lamps arrive broken. Couriers toss packages. Return shipping is killing her. 
- CONSTRAINTS: Emotional. Force '5 Whys' on why her lamps break. Reject "Cheap shipping" talk. Reward Empathy for her passion for her craft.`
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