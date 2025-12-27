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

// --- รายละเอียดตัวละคร (Hard Mode - เหมือนเดิมเป๊ะ) ---
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
                model: "llama-3.1-70b-versatile", // รุ่นประสิทธิภาพสูงและ RPM สูง
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
                temperature: 0.7,
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