const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = 'inclusionai/ling-3.0-flash:free';
const SKILLS_DIR = path.join(__dirname, 'skills');

async function ensureSkillsDir() {
  try {
    await fs.access(SKILLS_DIR);
  } catch {
    await fs.mkdir(SKILLS_DIR, { recursive: true });
  }
}

async function loadAllSkills() {
  try {
    await ensureSkillsDir();
    const files = await fs.readdir(SKILLS_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    
    const skills = await Promise.all(
      mdFiles.map(async (file) => {
        const filePath = path.join(SKILLS_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
      })
    );
    
    return skills;
  } catch {
    return [];
  }
}

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const { message, history = [], userContext = {}, model = OPENROUTER_MODEL } = req.body;

  try {
    let systemPrompt = 'Você é um assistente inteligente e prestativo. Responda em português brasileiro. Seja direto e útil.';
    
    if (userContext.name) {
      systemPrompt += ` O usuário se chama ${userContext.name}. Use esse nome nas respostas quando apropriado.`;
    }
    
    if (userContext.instructions) {
      systemPrompt += ` Instruções do usuário: ${userContext.instructions}`;
    }

    if (userContext.skillContent) {
      systemPrompt += `\n\n## Habilidade selecionada pelo usuário:\n\n${userContext.skillContent}\n\nUse esta habilidade para guiar sua resposta.`;
    }

    const skills = await loadAllSkills();
    if (skills.length > 0) {
      systemPrompt += '\n\n## Habilidades disponíveis:\n\n';
      skills.forEach((skillContent, i) => {
        systemPrompt += `### Habilidade ${i + 1}\n${skillContent}\n\n`;
      });
      systemPrompt += 'Use essas habilidades conforme apropriado para responder ao usuário.';
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'AI Assistant'
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 2048,
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    if (data.error) {
      return res.json({ response: `Erro: ${data.error.message}` });
    }

    const reply = data.choices?.[0]?.message?.content || 'Sem resposta';
    res.json({ response: reply });
  } catch (error) {
    console.error('Erro na API:', error);
    res.json({ response: 'Erro ao conectar com a IA. Verifique sua conexão.' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API server: http://localhost:${PORT}`);
});
