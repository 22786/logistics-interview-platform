require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const personas = require('./personas'); // <--- เพิ่มบรรทัดนี้

const app = express();
app.use(express.json());
app.use(express.static('public'));

const logFilePath = 'logs.csv';
if (!fs.existsSync(logFilePath)) {
    const header = "Timestamp,Student_ID,Student_Name,Persona,Question,AI_Response\n";
    fs.writeFileSync(logFilePath, header, 'utf8');
}




// --- Chat Route (Updated: Require API Key) ---
app.post('/chat', async (req, res) => {
    const { message, role, studentName, studentId, apiKey } = req.body;
    
    try {
        const systemInstruction = personas[role] || personas["somchai_retailer"];

        if (!apiKey || apiKey.trim() === "") {
            return res.status(400).json({ text: "⚠️ API Key is required. Please enter your Groq API Key." });
        }

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey.trim()}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: `${systemInstruction}\n\nIMPORTANT: Speak English only.` },
                    { role: "user", content: `Student: ${studentName} (${studentId})\nQuestion: ${message}` }
                ],
                temperature: 0.8
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || "Groq API Error");
        }

        const aiText = data.choices[0].message.content;

        // บันทึก Log
        const clean = (text) => `"${(text || "").toString().replace(/"/g, '""').replace(/\n/g, ' ')}"`;
        const logEntry = [clean(new Date().toLocaleString()), clean(studentId), clean(studentName), clean(role), clean(message), clean(aiText)].join(",") + "\n";
        fs.appendFileSync(logFilePath, logEntry);

        res.json({ text: aiText });

    } catch (error) {
        res.status(500).json({ text: `⚠️ Error: ${error.message}` });
    }
});

app.get('/admin/download-logs', (req, res) => {
    if (fs.existsSync(logFilePath)) res.download(logFilePath);
    else res.status(404).send("No log file found.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));