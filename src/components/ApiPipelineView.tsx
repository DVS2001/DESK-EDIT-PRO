import React, { useState } from 'react';
import { 
  Terminal, Play, Copy, Check, Code, Server, 
  Send, Sparkles, CheckCircle2, Cpu, ArrowRight
} from 'lucide-react';

export const ApiPipelineView: React.FC = () => {
  const [activeLang, setActiveLang] = useState<'curl' | 'python' | 'node'>('curl');
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [apiResponse, setApiResponse] = useState<any>(null);

  const [targetAspect, setTargetAspect] = useState('9:16');
  const [codec, setCodec] = useState('ProRes 422 HQ');
  const [webhookUrl, setWebhookUrl] = useState('https://api.empresa.com/v1/webhooks/render-complete');

  const curlCode = `curl -X POST https://omnicut.studio/api/v1/parallel-pipeline \\
  -H "Authorization: Bearer omni_sec_live_98418f7a" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "proj_master_keynote_4k",
    "target_aspect": "${targetAspect}",
    "output_format": "${codec}",
    "ai_enhancements": [
      "neural_denoise",
      "auto_reframe_smart_pan",
      "hormozi_captions_burn_in",
      "loudness_lufs_normalization"
    ],
    "webhook_url": "${webhookUrl}"
  }'`;

  const pythonCode = `import requests

payload = {
    "project_id": "proj_master_keynote_4k",
    "target_aspect": "${targetAspect}",
    "output_format": "${codec}",
    "ai_enhancements": [
        "neural_denoise",
        "auto_reframe_smart_pan",
        "hormozi_captions_burn_in",
        "loudness_lufs_normalization"
    ],
    "webhook_url": "${webhookUrl}"
}

headers = {
    "Authorization": "Bearer omni_sec_live_98418f7a",
    "Content-Type": "application/json"
}

response = requests.post(
    "https://omnicut.studio/api/v1/parallel-pipeline",
    json=payload,
    headers=headers
)

print("Job Token:", response.json().get("execution_token"))`;

  const nodeCode = `const response = await fetch("https://omnicut.studio/api/v1/parallel-pipeline", {
  method: "POST",
  headers: {
    "Authorization": "Bearer omni_sec_live_98418f7a",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    project_id: "proj_master_keynote_4k",
    target_aspect: "${targetAspect}",
    output_format: "${codec}",
    ai_enhancements: [
      "neural_denoise",
      "auto_reframe_smart_pan",
      "hormozi_captions_burn_in",
      "loudness_lufs_normalization"
    ],
    webhook_url: "${webhookUrl}"
  })
});

const data = await response.json();
console.log("Parallel Nodes Allocated:", data.nodes_allocated);`;

  const activeSnippet = activeLang === 'curl' ? curlCode : activeLang === 'python' ? pythonCode : nodeCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecuteLiveTest = async () => {
    setIsSending(true);
    try {
      const response = await fetch('/api/v1/parallel-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: 'proj_master_keynote_4k',
          target_aspect: targetAspect,
          output_format: codec,
          webhook_url: webhookUrl,
          ai_enhancements: [
            'neural_denoise',
            'auto_reframe_smart_pan',
            'hormozi_captions_burn_in',
            'loudness_lufs_normalization',
          ],
        }),
      });

      const data = await response.json();
      setApiResponse(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-1 bg-[#090d16] p-4 sm:p-6 overflow-y-auto select-none space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-cyan-950/40 via-sky-950/30 to-indigo-950/40 border border-cyan-800/40 rounded-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">API para Procesamiento Paralelo y Automatización</h2>
            <span className="text-[10px] font-mono bg-cyan-900/60 text-cyan-300 border border-cyan-700/60 px-2 py-0.5 rounded font-bold">
              REST &amp; Webhooks Batch Architecture
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl">
            Integra OmniCut Studio directamente en tus sistemas backend, marketing pipelines o herramientas de generación masiva de contenido para renderizado paralelo a escala.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono bg-black/40 px-3 py-2 rounded-lg border border-cyan-900/40">
          <div>
            <span className="text-slate-500 block text-[10px]">THROUGHPUT</span>
            <span className="text-cyan-300 font-bold">142.8 FPS / cluster</span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div>
            <span className="text-slate-500 block text-[10px]">CONCURRENCY</span>
            <span className="text-emerald-400 font-bold">Ilimitada</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: API Playground & Live Test Form */}
        <div className="bg-[#0c1220] border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Send className="w-4 h-4 text-cyan-400" />
            <span>Consola de Prueba en Vivo (Live Endpoint Test)</span>
          </h3>

          <div className="space-y-3 text-xs">
            {/* Target Aspect Ratio */}
            <div>
              <label className="text-slate-400 font-medium block mb-1">Formato de Salida (target_aspect)</label>
              <select
                value={targetAspect}
                onChange={(e) => setTargetAspect(e.target.value)}
                className="w-full bg-[#070b13] border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="9:16">9:16 Vertical (TikTok, Instagram Reels, Shorts)</option>
                <option value="16:9">16:9 Widescreen (YouTube, Cinema 4K)</option>
                <option value="1:1">1:1 Square (Instagram Post)</option>
              </select>
            </div>

            {/* Output Codec */}
            <div>
              <label className="text-slate-400 font-medium block mb-1">Códec de Render (output_format)</label>
              <select
                value={codec}
                onChange={(e) => setCodec(e.target.value)}
                className="w-full bg-[#070b13] border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="ProRes 422 HQ">Apple ProRes 422 HQ (10-bit Master)</option>
                <option value="H.264 High Profile">H.264 High Profile (Web Standard)</option>
                <option value="AV1 10-bit">AV1 Next-Gen HDR</option>
              </select>
            </div>

            {/* Webhook URL */}
            <div>
              <label className="text-slate-400 font-medium block mb-1">Callback Webhook (webhook_url)</label>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full bg-[#070b13] border border-slate-700 rounded-lg p-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              onClick={handleExecuteLiveTest}
              disabled={isSending}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 transition active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isSending ? 'Ejecutando en Cluster...' : 'Enviar Solicitud a la API'}</span>
            </button>
          </div>

          {/* Live Response Output */}
          {apiResponse && (
            <div className="p-3 bg-[#070b13] border border-cyan-900/60 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-emerald-400 font-mono font-bold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>HTTP 200 OK - Job Accepted</span>
                </span>
                <span>{apiResponse.cluster}</span>
              </div>
              <pre className="text-[11px] font-mono text-cyan-200 overflow-x-auto p-2 bg-black/60 rounded border border-slate-800">
                {JSON.stringify(apiResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Right Column: Code Snippets & Spec */}
        <div className="bg-[#0c1220] border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Code className="w-4 h-4 text-cyan-400" />
              <span>Ejemplos de Integración</span>
            </h3>

            {/* Language Switcher */}
            <div className="flex items-center bg-[#070b13] border border-slate-700 rounded p-0.5 text-xs">
              <button
                onClick={() => setActiveLang('curl')}
                className={`px-2 py-0.5 rounded font-mono ${activeLang === 'curl' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400'}`}
              >
                cURL
              </button>
              <button
                onClick={() => setActiveLang('python')}
                className={`px-2 py-0.5 rounded font-mono ${activeLang === 'python' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400'}`}
              >
                Python
              </button>
              <button
                onClick={() => setActiveLang('node')}
                className={`px-2 py-0.5 rounded font-mono ${activeLang === 'node' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400'}`}
              >
                Node.js
              </button>
            </div>
          </div>

          <div className="relative flex-1">
            <pre className="w-full h-full p-4 bg-[#070b13] border border-slate-800 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
              {activeSnippet}
            </pre>

            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 bg-slate-800/80 hover:bg-slate-700 text-slate-200 p-1.5 rounded-lg border border-slate-700 text-xs flex items-center gap-1 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
