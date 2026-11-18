import express, { type Request, type Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '25mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  apiVersion: 'v1beta',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

function buildNeutralSystemInstruction(options?: {
  language?: string;
  responseLength?: 'concise' | 'balanced' | 'detailed';
  personalisation?: string;
  isLive?: boolean;
}): string {
  const parts: string[] = [
    'You are a helpful, clear, and thoughtful personal AI assistant.',
  ];

  if (options?.language && options.language !== 'Auto') {
    parts.push(`Respond in ${options.language} unless the user asks for another language.`);
  }

  if (options?.responseLength === 'concise' || options?.isLive) {
    parts.push('Keep responses clear, direct, and concise.');
  } else if (options?.responseLength === 'detailed') {
    parts.push('Provide thorough, well-structured answers when helpful.');
  }

  if (options?.personalisation?.trim()) {
    parts.push(`User context preference: ${options.personalisation.trim()}`);
  }

  return parts.join(' ');
}

app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    defaultModel: 'gemini-3.8-flash',
    liveModel: 'gemini-3.8-live',
    timestamp: Date.now(),
  });
});

app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { messages, preferences, stream = true } = req.body || {};

    if (!process.env.GEMINI_API_KEY) {
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(
          `data: ${JSON.stringify({
            chunk: 'Server API key is not configured. Please check the environment configuration.',
            done: true,
          })}\n\n`
        );
        return res.end();
      }
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing in server environment.' });
    }

    const systemInstruction = buildNeutralSystemInstruction({
      language: preferences?.language,
      responseLength: preferences?.responseLength,
      personalisation: preferences?.personalisation,
      isLive: false,
    });

    const contents: any[] = [];
    if (Array.isArray(messages)) {
      for (const m of messages) {
        const msgParts: any[] = [];
        if (m.text && typeof m.text === 'string') {
          msgParts.push({ text: m.text });
        }
        if (Array.isArray(m.attachments)) {
          for (const att of m.attachments) {
            if (att.dataUrl && typeof att.dataUrl === 'string') {
              const match = att.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                const mimeType = match[1];
                const base64Data = match[2];
                if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
                  msgParts.push({
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  });
                } else if (att.textPreview) {
                  msgParts.push({
                    text: `[Attached file: ${att.name}]\n${att.textPreview}`,
                  });
                } else {
                  msgParts.push({
                    text: `[Attached file: ${att.name} (${mimeType})]`,
                  });
                }
              }
            } else if (att.name) {
              msgParts.push({ text: `[Attached file: ${att.name}]` });
            }
          }
        }
        if (msgParts.length > 0) {
          contents.push({
            role: m.isModel ? 'model' : 'user',
            parts: msgParts,
          });
        }
      }
    }

    if (contents.length === 0) {
      return res.status(400).json({ error: 'Messages are required.' });
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest'];
      let streamedAny = false;

      for (const modelName of candidateModels) {
        try {
          const responseStream = await ai.models.generateContentStream({
            model: modelName,
            contents,
            config: {
              systemInstruction,
            },
          });

          for await (const chunk of responseStream) {
            const textChunk = chunk.text;
            if (textChunk) {
              streamedAny = true;
              res.write(`data: ${JSON.stringify({ chunk: textChunk })}\n\n`);
            }
          }
          if (streamedAny) break;
        } catch (err: any) {
          console.warn(`Stream model ${modelName} warning:`, err?.message || err);
        }
      }

      if (!streamedAny) {
        res.write(
          `data: ${JSON.stringify({
            chunk: 'I could not generate a response right now. Please try again.',
          })}\n\n`
        );
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      return res.end();
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: { systemInstruction },
    });

    return res.json({ text: response.text || '', isModel: true });
  } catch (err: any) {
    console.error('Chat error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err?.message || 'Failed to generate response' });
    }
    res.write(`data: ${JSON.stringify({ error: 'Stream interrupted', done: true })}\n\n`);
    return res.end();
  }
});

// Neural Text-to-Speech endpoint using Gemini TTS
const ttsAudioCache = new Map<string, string>();
const ALLOWED_VOICES = ['Aoede', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, voice = 'Aoede', language = 'English' } = req.body || {};

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing in server environment.' });
    }

    const cleanText = typeof text === 'string' ? text.trim().slice(0, 1200) : '';
    if (!cleanText) {
      return res.status(400).json({ error: 'Text is required for speech synthesis.' });
    }

    const selectedVoice = ALLOWED_VOICES.includes(voice) ? voice : 'Aoede';
    const cacheKey = `${selectedVoice}:${language}:${cleanText}`;
    const cachedAudio = ttsAudioCache.get(cacheKey);
    if (cachedAudio) {
      return res.json({
        audioBase64: cachedAudio,
        mimeType: 'audio/wav',
        voice: selectedVoice,
      });
    }

    const languageStyleMap: Record<string, string> = {
      English: 'Speak in natural, clear, conversational English',
      Hindi: 'Speak in natural, fluent native Hindi with accurate pronunciation',
      Urdu: 'Speak in natural, fluent native Urdu with accurate pronunciation',
      Spanish: 'Speak in natural, fluent native Spanish with clear pronunciation',
      French: 'Speak in natural, fluent native French with smooth pronunciation',
      Arabic: 'Speak in natural, fluent native Arabic with clear pronunciation',
      German: 'Speak in natural, fluent native German with clear pronunciation',
    };
    const voiceStyle =
      languageStyleMap[language || 'English'] ||
      `Speak in natural, fluent ${language || 'English'} with clear human pronunciation`;

    const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
    let base64Audio: string | undefined;
    let lastError: any = null;

    for (const ttsModel of ttsModels) {
      try {
        const response = await ai.models.generateContent({
          model: ttsModel,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style: voiceStyle,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        });

        base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`TTS model ${ttsModel} warning:`, err?.message || err);
      }
    }

    if (!base64Audio) {
      const errMsg = String(lastError?.message || '');
      if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
        return res.status(429).json({
          error: 'Voice service is busy right now. Please wait a few seconds and try again.',
        });
      }
      return res.status(502).json({
        error: 'Unable to synthesize speech for the selected voice. Please try again.',
      });
    }

    if (ttsAudioCache.size > 40) {
      const oldestKey = ttsAudioCache.keys().next().value;
      if (oldestKey) ttsAudioCache.delete(oldestKey);
    }
    ttsAudioCache.set(cacheKey, base64Audio);

    return res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      voice: selectedVoice,
    });
  } catch (err: any) {
    console.error('TTS error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to generate speech' });
  }
});

// WebSocket Server for /live real-time voice streaming (isolated to /live path)
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const pathname = new URL(
      request.url || '/',
      `http://${request.headers.host || 'localhost'}`
    ).pathname;
    if (pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  } catch {
    /* ignore malformed upgrade url */
  }
});

wss.on('connection', async (clientWs: WebSocket) => {
  let liveSession: any = null;
  let isLiveConnected = false;
  let sessionPrefs: any = {};

  clientWs.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'init') {
        sessionPrefs = msg.settings || {};
        const voiceName = sessionPrefs.voice || 'Aoede';
        const systemInstruction = buildNeutralSystemInstruction({
          language: sessionPrefs.language,
          responseLength: 'concise',
          personalisation: sessionPrefs.personalisation,
          isLive: true,
        });

        try {
          if (process.env.GEMINI_API_KEY) {
            liveSession = await ai.live.connect({
              model: 'gemini-3.8-live',
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                  },
                },
                systemInstruction,
              },
              callbacks: {
                onmessage: (serverMsg: any) => {
                  try {
                    const audioChunk =
                      serverMsg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioChunk && clientWs.readyState === WebSocket.OPEN) {
                      clientWs.send(JSON.stringify({ audio: audioChunk }));
                    }

                    if (
                      serverMsg.serverContent?.interrupted &&
                      clientWs.readyState === WebSocket.OPEN
                    ) {
                      clientWs.send(JSON.stringify({ interrupted: true }));
                    }

                    const textPart = serverMsg.serverContent?.modelTurn?.parts?.find(
                      (p: any) => p.text
                    );
                    if (textPart?.text && clientWs.readyState === WebSocket.OPEN) {
                      clientWs.send(JSON.stringify({ text: textPart.text, isModel: true }));
                    }
                  } catch (e) {
                    console.error('Error forwarding live message to client:', e);
                  }
                },
                onerror: (err: any) => {
                  console.warn('Live session error:', err);
                },
                onclose: () => {
                  isLiveConnected = false;
                },
              },
            });

            isLiveConnected = true;
          }
        } catch (liveErr) {
          console.warn('Live API connection fallback enabled:', liveErr);
          isLiveConnected = false;
        }

        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'ready', isLive: isLiveConnected }));
        }
        return;
      }

      if (msg.audio) {
        if (isLiveConnected && liveSession) {
          try {
            liveSession.sendRealtimeInput({
              audio: {
                data: msg.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } catch (e) {
            console.error('Error sending audio to Live API:', e);
          }
        }
        return;
      }

      if (msg.type === 'text' && msg.text) {
        if (isLiveConnected && liveSession) {
          try {
            liveSession.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [{ text: msg.text }],
                },
              ],
              turnComplete: true,
            });
          } catch (e) {
            console.error('Error sending text to Live API:', e);
            fallbackTextRespond(clientWs, msg.text, sessionPrefs);
          }
        } else {
          fallbackTextRespond(clientWs, msg.text, sessionPrefs);
        }
      }
    } catch (err) {
      console.error('WebSocket incoming message parse error:', err);
    }
  });

  clientWs.on('close', () => {
    if (liveSession) {
      try {
        liveSession.close();
      } catch {
        /* ignore */
      }
      liveSession = null;
    }
  });
});

async function fallbackTextRespond(clientWs: WebSocket, userText: string, prefs?: any) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userText,
      config: {
        systemInstruction: buildNeutralSystemInstruction({
          language: prefs?.language,
          responseLength: 'concise',
          personalisation: prefs?.personalisation,
          isLive: true,
        }),
      },
    });
    const reply = response.text || 'I heard you. How can I help?';
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ text: reply, isModel: true, isFinal: true }));
    }
  } catch {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          text: 'Connection briefly interrupted. Please try again.',
          isModel: true,
          isFinal: true,
        })
      );
    }
  }
}

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(
      `AI Assistant server running on port ${PORT} [mode: ${isProd ? 'production' : 'development'}]`
    );
  });
}

startServer();
