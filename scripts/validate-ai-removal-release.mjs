// Real Edge/Chromium release regression; no Playwright or application test endpoint.
// Node 22+ with global WebSocket, Bun-installed dependencies, ffmpeg/ffprobe required.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, openSync, closeSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

export const retiredResource = /multicam|silero|\.orma\b|\botio\b|kieai|kie\.ai|elevenlabs|openai|anthropic|huggingface|onnxruntime|mediapipe|tflite|\.onnx\b|whisper|speech-to-text|person-segmentation|background-removal|behind-subject|\/api\/proxy(?:\/|\b)|llm-transport|\/services\/agent\/|chat-store|ai-connection-store|ai-shader|GenerateShaderBox|creation-agent|\/desktop\//i;
export const retiredUI = /Multi-Camera Editing|AI Generate|AI Editor|Text to Speech|Auto Captions|Screen recorder|Editor tour|Animation & effects tour|Save as Template|Browse Templates/i;
const root = fileURLToPath(new URL("../", import.meta.url));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command}: ${result.stderr || result.error?.message}`);
  return result.stdout;
};
async function freePort() {
  const server = createServer();
  await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}

export async function validateRelease({ directory = ".codex-audit/phase5/browser", browserPath = process.env.OPENREEL_BROWSER, compact = false } = {}) {
  directory = resolve(root, directory);
  assert.ok(directory.startsWith(resolve(root, ".codex-audit") + "/") || directory.startsWith(resolve(root, ".codex-audit") + "\\"), "Keep verification outputs under .codex-audit/");
  browserPath ??= ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/chromium", "/usr/bin/google-chrome"].find(existsSync);
  assert.ok(browserPath, "Set OPENREEL_BROWSER to an installed Chromium/Edge executable");
  assert.equal(typeof WebSocket, "function", "Use Node 22+ (global WebSocket)");
  mkdirSync(directory, { recursive: true });
  run(process.execPath, ["apps/web/scripts/validate-browser-export.mjs", "fixtures", join(directory, "fixtures")]);
  run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=48000:duration=2", join(directory, "audio.wav")]);
  run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=green:s=32x32", "-frames:v", "1", join(directory, "image.png")]);
  writeFileSync(join(directory, "manual.srt"), "1\n00:00:00,000 --> 00:00:01,000\nManual caption\n");
  writeFileSync(join(directory, "manual.vtt"), "WEBVTT\n\n00:00.000 --> 00:01.000\nVTT local\n");
  const profile = join(directory, `profile-${Date.now()}`);
  const downloadDirectory = join(directory, `downloads-${Date.now()}`);
  mkdirSync(downloadDirectory, { recursive: true });
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const log = openSync(join(directory, "vite.log"), "w");
  const server = spawn(process.execPath, [resolve(root, "apps/web/node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: resolve(root, "apps/web"), stdio: ["ignore", log, log] });
  const browser = spawn(browserPath, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--autoplay-policy=no-user-gesture-required", "--enable-unsafe-webgpu", "--use-angle=swiftshader", "about:blank"], { stdio: "ignore" });
  const report = { passed: false, compact, browserPath, origin, profile, checks: [], requests: [], workers: [], exceptions: [], console: [], probes: [], offline: false };
  let ws, sequence = 0, phase = "boot";
  const pending = new Map(), sessions = new Set(), instrumentation = [];
  const send = (method, params = {}, sessionId) => new Promise((done, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 120000);
    pending.set(id, { done, reject, timer });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const goOffline = (sessionId) => sessionId
    ? send("Network.setBlockedURLs", { urls: ["http://*", "https://*"] }, sessionId)
    : send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const check = async (name, action) => {
    phase = name;
    const result = await action();
    report.checks.push({ name, result });
    console.log(`PASS ${name}`, result ?? "");
    return result;
  };
  const waitForDownload = async (extension) => {
    for (let attempt = 0; attempt < 600; attempt++) {
      const name = readdirSync(downloadDirectory).find((entry) => entry.endsWith(extension));
      if (name) return join(downloadDirectory, name);
      await sleep(100);
    }
    throw new Error(`No downloaded ${extension} file in ${downloadDirectory}`);
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 300; attempt++) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    throw new Error(`Browser condition not met: ${expression}`);
  };
  try {
    for (let i = 0; i < 150 && !existsSync(join(profile, "DevToolsActivePort")); i++) await sleep(100);
    const debugPort = Number(readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]);
    const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
    ws = new WebSocket(pages.find((page) => page.type === "page").webSocketDebuggerUrl);
    await new Promise((done, reject) => { ws.onopen = done; ws.onerror = reject; });
    ws.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const request = pending.get(message.id);
        if (request) {
          clearTimeout(request.timer); pending.delete(message.id);
          message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.done(message.result);
        }
      }
      const { method, params, sessionId } = message;
      if (method === "Network.requestWillBeSent") report.requests.push({ phase, sessionId, url: params.request.url, type: params.type, method: params.request.method });
      if (method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(params.type)) report.console.push({ phase, sessionId, type: params.type, args: params.args.map(arg=>arg.value ?? arg.description) });
      if (method === "Runtime.exceptionThrown") report.exceptions.push({ phase, sessionId, details: params.exceptionDetails });
      if (method === "Target.attachedToTarget") {
        const child = params.sessionId;
        sessions.add(child); report.workers.push({ phase, ...params.targetInfo });
        // Pause workers until their network logging is enabled, including nested workers.
        instrumentation.push((async () => {
          await send("Network.enable", {}, child);
          await send("Runtime.enable", {}, child);
          await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, child);
          if (report.offline) await goOffline(child);
          await send("Runtime.runIfWaitingForDebugger", {}, child);
        })().catch((error) => { report.exceptions.push({ phase, instrumentation: String(error) }); }));
      }
      if (method === "Target.detachedFromTarget") sessions.delete(params.sessionId);
    };
    await send("Network.enable"); await send("Runtime.enable"); await send("Page.enable");
    await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
    await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDirectory });
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `
      window.__releaseProbe={workers:[],databases:[],deletes:[],permissions:[]};
      const W=Worker;window.Worker=class extends W{constructor(url,options){window.__releaseProbe.workers.push(String(url));super(url,options)}};
      const open=indexedDB.open.bind(indexedDB);indexedDB.open=(name,...args)=>{window.__releaseProbe.databases.push(name);return open(name,...args)};
      const del=indexedDB.deleteDatabase.bind(indexedDB);indexedDB.deleteDatabase=(name)=>{window.__releaseProbe.deletes.push(name);return del(name)};
      for(const key of ['getUserMedia','getDisplayMedia'])if(navigator.mediaDevices?.[key]){const fn=navigator.mediaDevices[key].bind(navigator.mediaDevices);navigator.mediaDevices[key]=(...args)=>{window.__releaseProbe.permissions.push(key);return fn(...args)}};
      if(!localStorage.getItem('release-unrelated'))localStorage.setItem('release-unrelated','preserved');
    ` });
    for (let i = 0; i < 150; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await sleep(100); }
    await send("Page.navigate", { url: origin });
    await waitFor("document.body?.innerText.includes('Export') && !document.body.innerText.includes('Loading OpenReel')");
    const corePath = "/@fs/" + resolve(root, "packages/core/src/index.ts").replaceAll("\\", "/");
    await evaluate(`(async()=>{
      window.gate={};gate.core=await import(${JSON.stringify(corePath)});
      gate.edit=await import(${JSON.stringify(corePath.replace(/index\.ts$/, "editing/portable-project.ts"))});
      gate.store=(await import('/src/stores/project-store.ts')).useProjectStore;
      gate.ui=(await import('/src/stores/ui-store.ts')).useUIStore;
      gate.engines=(await import('/src/stores/engine-store.ts')).useEngineStore;
      gate.timeline=(await import('/src/stores/timeline-store.ts')).useTimelineStore;
      gate.portable=await import('/src/services/editing/portable-edits.ts');
      gate.sync=(await import('/src/services/editing/creation-sync.ts')).syncCreationSceneToMotion;
      gate.auto=(await import('/src/services/auto-save.ts')).autoSaveManager;
      gate.presets=(await import('/src/services/export-presets.ts')).exportPresetsManager;
      gate.motion=(await import('/src/motion/stores/motion-store.ts')).useMotionStore;
      gate.queue=(await import('/src/motion/render-queue-runner.ts')).runMotionRenderQueue;
      gate.package=await import('/src/services/project-package.ts');
      gate.assert=(condition,message)=>{if(!condition)throw new Error(message)};
      gate.click=(label)=>{const b=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')===label||b.textContent.trim()===label)&&b.checkVisibility());gate.assert(b,'Missing visible button '+label);gate.assert(!b.disabled,'Disabled button '+label+' '+document.body.innerText.slice(-1600));b.click()};
      gate.pause=(ms=150)=>new Promise(r=>setTimeout(r,ms));
      gate.s=()=>gate.store.getState();
    })()`);
    await check("editor-first routes and navigation", async () => {
      const result = await evaluate(`(async()=>{
        const id=gate.s().project.id;
        for(const hash of ['#/editor','#/unknown','#/welcome','#/templates','#/recent']){location.hash=hash;await gate.pause();gate.assert(gate.s().project.id===id,'Route replaced loaded project')}
        for(const tab of ['Audio','Effects','Text','Media']){gate.click(tab);await gate.pause()}
        return {projectUnchanged:true,body:document.body.innerText};
      })()`);
      assert.equal(retiredUI.test(result.body), false); delete result.body;
      await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await sleep(300);
      result.compact = await evaluate(`(async()=>{const nav=document.querySelector('nav[aria-label="Editor workspace"]');gate.assert(nav,'Missing compact navigation');const labels=[...nav.querySelectorAll('button')].map(b=>b.textContent.trim());for(const b of nav.querySelectorAll('button')){b.click();await gate.pause()}return labels})()`);
      assert.deepEqual(result.compact, ["Timeline", "Media", "Edit"]);
      await send("Emulation.setDeviceMetricsOverride", { width: compact ? 390 : 1440, height: compact ? 844 : 900, deviceScaleFactor: 1, mobile: compact });
      return result;
    });
    const files = Object.fromEntries([['video', 'fixtures/landscape-av.mp4'], ['audio', 'audio.wav'], ['image', 'image.png']].map(([key, name]) => [key, readFileSync(join(directory, name)).toString("base64")]));
    await evaluate(`gate.files=${JSON.stringify(files)};gate.current=${JSON.stringify(JSON.parse(readFileSync(resolve(root, "packages/core/src/test/fixtures/current-project.json"), "utf8")))};`);
    await check("import, trim, split, multitrack and history", () => evaluate(`(async()=>{
      gate.s().createNewProject('Phase5 release',{width:640,height:360,frameRate:24});await gate.pause();
      gate.assert(document.body.innerText.includes('Phase5 release'),'Harness must use live UI store');
      gate.file=(key)=>new File([Uint8Array.from(atob(gate.files[key]),c=>c.charCodeAt(0))],{video:'landscape-av.mp4',audio:'audio.wav',image:'image.png'}[key],{type:{video:'video/mp4',audio:'audio/wav',image:'image/png'}[key]});
      for(const key of ['video','audio','image']){const imported=await gate.s().importMedia(gate.file(key));gate.assert(imported.success,'Import '+key+' '+JSON.stringify(imported));}
      const media=gate.s().project.mediaLibrary.items;gate.video=media.find(m=>m.type==='video');
      for(const [track,type] of [['base','video'],['overlay','video'],['audio','audio'],['image','image']]){
        await gate.s().addTrack(type,undefined,{trackId:track});
        const source=media.find(m=>m.type===type);gate.assert((await gate.s().addClip(track,source.id,0)).success,'Add '+type);
        const clip=gate.s().project.timeline.tracks.find(t=>t.id===track).clips[0];
        if(type!=='image')gate.assert((await gate.s().trimClip(clip.id,0.5,2)).success,'Trim '+track);
        else gate.assert((await gate.s().trimClip(clip.id,0,1.5)).success,'Trim image');
      }
      gate.base=gate.s().project.timeline.tracks.find(t=>t.id==='base').clips[0].id;
      const before=JSON.stringify(gate.s().project.timeline);
      gate.assert((await gate.s().splitClip(gate.base,0.75)).success,'Split');await gate.s().undo();gate.assert(JSON.stringify(gate.s().project.timeline)===before,'Split undo');await gate.s().redo();await gate.s().undo();
      const overlay=gate.s().project.timeline.tracks.find(t=>t.id==='overlay').clips[0];
      gate.assert((await gate.s().executeAction({type:'transform/update',id:crypto.randomUUID(),timestamp:Date.now(),params:{clipId:overlay.id,transform:{rotation:15,opacity:0.5}}})).success,'Transform');
      gate.assert((await gate.s().executeAction({type:'keyframe/add',id:crypto.randomUUID(),timestamp:Date.now(),params:{clipId:overlay.id,property:'opacity',time:0.5,value:0.25,easing:'linear'}})).success,'Keyframe');
      await gate.s().hideTrack('overlay',true);await gate.s().muteTrack('audio',true);await gate.s().hideTrack('image',true);await gate.s().lockTrack('overlay',true);
      gate.s().groupTracks('base','overlay');
      return {types:media.map(m=>m.type),splitUndoRedo:true,tracks:gate.s().project.timeline.tracks.length};
    })()`));
    await check("Recipes, encoding presets and portable edits/relink", () => evaluate(`(async()=>{
      const recipe=gate.s().applyEditingTemplate('branding-lower-third',gate.base,{name:'Ada',role:'Director'});gate.assert(recipe,'Apply Recipe');
      gate.assert(gate.s().updateEditingTemplateApplication(gate.base,recipe,{name:'Grace',role:'Engineer'}),'Update Recipe');
      gate.assert(gate.s().getAllTextClips().some(c=>c.text==='Grace'),'Recipe title');
      gate.assert(gate.s().removeEditingTemplateApplication(gate.base,recipe),'Remove Recipe');
      gate.assert(gate.presets.getPreset('youtube-4k').settings.width===3840,'Built-in preset');
      const custom=gate.presets.addCustomPreset({name:'Release custom',description:'Manual encoding',platform:'Custom',settings:gate.presets.getPreset('youtube-4k').settings});
      gate.assert(gate.presets.getPreset(custom.id),'Custom preset saved');
      const preset={format:'openreel-preset',version:1,name:'Brightness',effects:[{id:'source-effect',type:'brightness',params:{value:0.1},enabled:true}]};
      await gate.portable.applySharedPreset(gate.base,preset);gate.assert(gate.s().getClip(gate.base).effects.length===1,'Shared preset');await gate.s().undo();await gate.s().redo();await gate.s().undo();
      const portable=gate.edit.parsePortableEdit(JSON.stringify(gate.edit.createPortableEdit(gate.s().getFullProject())));
      await gate.portable.importPortableEdit(portable);await gate.s().undo();await gate.s().redo();
      await gate.portable.relinkSharedMedia(gate.video.id,gate.file('video'));
      gate.assert(gate.s().getClip(gate.base).mediaId===gate.video.id,'Relink changed media references');
      return {recipe:true,builtInAndCustom:true,portable:true,relink:true};
    })()`));
    await check("manual SRT/VTT DOM file inputs", async () => {
      await evaluate(`(async()=>{if(document.querySelector('nav[aria-label="Editor workspace"]'))gate.click('Edit');gate.ui.getState().select({type:'clip',id:gate.base,trackId:'base'});await gate.pause(300);const section=document.querySelector('[data-section-id="editable-captions"]');gate.assert(section,'Caption section');if(!document.querySelector('input[aria-label="Import SRT or VTT file"]'))section.querySelector('[aria-expanded]').click();await gate.pause()})()`);
      for (const name of ["manual.srt", "manual.vtt"]) {
        const { root: doc } = await send("DOM.getDocument");
        const { nodeId } = await send("DOM.querySelector", { nodeId: doc.nodeId, selector: 'input[aria-label="Import SRT or VTT file"]' });
        assert.ok(nodeId); await send("DOM.setFileInputFiles", { nodeId, files: [join(directory, name)] }); await sleep(400);
      }
      return evaluate(`(()=>{const clips=gate.s().getAllTextClips();gate.assert(clips.some(c=>c.text==='VTT local'),'VTT');const srt=clips.find(c=>c.text==='Manual caption');gate.assert(srt,'SRT');gate.s().updateTextContent(srt.id,'Edited manual caption');return {srt:true,vtt:true,edited:true}})()`);
    });
    await check("retained creation/motion engines and atomic synchronization", () => evaluate(`(async()=>{
      const p=gate.s().getFullProject();gate.s().loadProject({...p,creation:gate.current.creation,motionCompositions:gate.current.motionCompositions,generatedShaders:gate.current.generatedShaders});
      const creation=structuredClone(gate.s().project.creation);creation.scenes[0].objects[0].transform.position.x=0.25;
      gate.s().loadProject({...gate.s().getFullProject(),creation});
      const result=await gate.sync({sceneId:'creation-scene'});gate.assert(result.layerId==='creation-layer','Binding ID changed');
      const synced=JSON.stringify(gate.s().project.motionCompositions);await gate.s().undo();await gate.s().redo();gate.assert(JSON.stringify(gate.s().project.motionCompositions)===synced,'Sync history');
      const comp=gate.s().project.motionCompositions[0];gate.assert(comp.layers.some(l=>l.variableBindings?.[0]?.variableId==='headline'),'Generic binding lost');
      gate.motion.getState().setActiveCompositionId(comp.id);
      return {sceneObjectEdited:true,bindingId:result.layerId,variables:true,undoRedo:true};
    })()`));
    await check("current-format package, IndexedDB, recent and recovery", () => evaluate(`(async()=>{
      const p=gate.s().getFullProject();const serializer=gate.core.createProjectSerializer(gate.core.createStorageEngine());
      const packed=await gate.package.createProjectPackage(p);const restored=await gate.package.readProjectPackage(packed);
      gate.assert(restored.mediaLibrary.items.every(m=>m.blob?.size>0),'Packaged media bytes lost');
      gate.assert(JSON.stringify(restored.creation)===JSON.stringify(p.creation),'Packaged creation changed');
      const json=serializer.exportToJsonWithMetadata(p,'Release');const reopened=serializer.importFromJsonWithValidation(json).project;
      gate.assert(reopened.generatedShaders.length===1,'Shader lost');gate.assert(reopened.motionCompositions[0].layers[0].variableBindings.length===1,'Bindings lost');
      await serializer.saveProject(p);const db=await serializer.loadProject(p.id);gate.assert(db.mediaLibrary.items.every(m=>m.blob?.size>0),'DB media lost');
      await gate.auto.forceSave(p);const save=await gate.auto.getMostRecentSave(p.id);gate.assert(save,'No recovery snapshot');
      const recovered=await gate.auto.recover(save.id);gate.assert(recovered.id===p.id,'Recovery ID');
      gate.assert(JSON.stringify(recovered.creation)===JSON.stringify(p.creation),'Recovery creation');gate.assert(recovered.textClips.some(c=>c.text==='Edited manual caption'),'Recovery captions');
      gate.assert((await serializer.loadProject(p.id)).mediaLibrary.items[0].blob.size>0,'Recovery damaged stored media');
      gate.s().loadProject(db);gate.serializer=serializer;gate.projectJson=json;
      gate.click(p.name);await gate.pause();gate.click('New Project');await gate.pause();gate.assert(gate.s().project.id!==p.id,'New project UI');
      gate.click(gate.s().project.name);await gate.pause(300);gate.click('Open '+p.name);for(let i=0;i<150&&gate.s().project.id!==p.id;i++)await gate.pause(200);gate.assert(gate.s().project.id===p.id,'Recent-project UI failed '+document.body.innerText.slice(-1000));
      gate.assert(gate.s().project.mediaLibrary.items.every(m=>m.blob?.size>0),'Recent recovery did not restore local media');
      return {packageBytes:packed.size,mediaBytes:true,recent:true,recovery:true,shaders:true,bindings:true};
    })()`));
    await check("saved GLSL execution and manual chroma/effects", () => evaluate(`(async()=>{
      const {MotionShaderRenderer}=await import(${JSON.stringify(corePath.replace(/index\.ts$/, "motion/motion-shader-renderer.ts"))});
      const def=gate.core.getMotionShaderDef('saved-amber');gate.assert(def,'Saved shader registry');
      const renderer=new MotionShaderRenderer();const canvas=renderer.render(def,{width:32,height:32,time:0,params:{amount:0.8}});
      const gl=canvas.getContext('webgl2');gate.assert(gl,'Shader must execute in WebGL2');const pixel=new Uint8Array(4);gl.readPixels(16,16,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);renderer.dispose();
      gate.assert(Math.abs(pixel[0]-204)<=1&&Math.abs(pixel[1]-128)<=1&&pixel[2]===0&&pixel[3]===255,'Incorrect GLSL pixel '+pixel);
      const chromaKey={enabled:true,keyColor:{r:0,g:1,b:0},tolerance:0.1,edgeSoftness:0.1,spillSuppression:0.5};
      gate.assert((await gate.s().executeAction({type:'clip/setChromaKey',id:crypto.randomUUID(),timestamp:Date.now(),params:{clipId:gate.base,chromaKey}})).success,'Chroma key action');
      gate.assert(gate.s().getClip(gate.base).chromaKey.enabled,'Chroma key persistence');await gate.s().undo();await gate.s().redo();
      await gate.portable.applySharedPreset(gate.base,{format:'openreel-preset',version:1,name:'Brightness',effects:[{id:'brightness',type:'brightness',params:{value:0.05},enabled:true}]});
      return {shaderPixel:[...pixel],chromaKey:true,brightness:true};
    })()`));
    // Capture several seek positions and close every returned frame exactly once.
    await check("title, transition, seeking and frame ownership", () => evaluate(`(async()=>{
      if(document.querySelector('nav[aria-label="Editor workspace"]'))gate.click('Timeline');
      await gate.s().addTrack('text',0,{trackId:'release-title'});
      const title=gate.s().createTextClip('release-title',0,'PHASE 5',1.5,{fontFamily:'Arial',fontSize:64,color:'#ffffff',backgroundColor:'#ff00ff'});gate.assert(title,'Title');
      gate.assert(await gate.s().addClipTransition({id:'release-intro',clipAId:gate.base,edge:'in',type:'crossfade',duration:0.25,params:{}}),'Intro transition');
      await gate.engines.getState().initialize();const engine=gate.engines.getState().videoEngine;
      let frames=0;for(const time of [0.125,0.75,1.25,0.25,0.75]){const frame=await engine.renderFrame(gate.s().getFullProject(),time,640,360);try{gate.assert(frame.width===640,'Frame size');frames++}finally{frame.image.close()}}
      for(const time of [0.125,0.75]){gate.timeline.getState().setPlayheadPosition(time);let magenta=0;for(let attempt=0;attempt<50;attempt++){await gate.pause(100);const stage=document.querySelector('.editor-stage canvas');gate.assert(stage,'UI canvas');const c=new OffscreenCanvas(640,360);const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(stage,0,0,640,360);const data=ctx.getImageData(0,0,640,360).data;magenta=0;for(let y=140;y<220;y++)for(let x=200;x<440;x++){const i=(y*640+x)*4;if(data[i]>220&&data[i+1]<40&&data[i+2]>220)magenta++}if(magenta>400)break}gate.assert(magenta>400,'Title invisible at '+time)}
      const f=await engine.renderFrame(gate.s().getFullProject(),0.75,640,360);const c=new OffscreenCanvas(640,360);const ctx=c.getContext('2d');try{ctx.drawImage(f.image,0,0)}finally{f.image.close()}
      let binary='';for(const byte of ctx.getImageData(0,0,640,360).data)binary+=String.fromCharCode(byte);gate.preview=btoa(binary);
      return {closedFrames:frames+1,titleDuringAndAfterTransition:true,seek:true};
    })()`));
    writeFileSync(join(directory, "preview.rgba"), Buffer.from(await evaluate("gate.preview"), "base64"));
    await check("project backup download and DOM reopen", async () => {
      const previousId = await evaluate("gate.s().project.id");
      await evaluate(`(async()=>{gate.click(gate.s().project.name);await gate.pause();gate.click('Project backups')})()`);
      await waitFor("document.body.innerText.includes('Download backup')");
      await evaluate("gate.click('Download backup')");
      const backup = await waitForDownload(".oreelpack");
      const { root: doc } = await send("DOM.getDocument");
      const { nodeId } = await send("DOM.querySelector", { nodeId: doc.nodeId, selector: 'input[aria-label="Project backup file"]' });
      assert.ok(nodeId); await send("DOM.setFileInputFiles", { nodeId, files: [backup] });
      await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Open this project'&&!b.disabled)");
      await evaluate("gate.click('Open this project')");
      await waitFor(`gate.s().project.id!==${JSON.stringify(previousId)} && !document.querySelector('input[aria-label="Project backup file"]')`);
      return evaluate(`(async()=>{gate.assert(gate.s().project.mediaLibrary.items.every(m=>m.blob?.size>0),'Backup UI media');gate.assert(await gate.auto.getMostRecentSave(${JSON.stringify(previousId)}),'Opening backup lost previous project');return {download:true,domOpen:true,previousProjectPreserved:true}})()`);
    });
    await check("offline edit, history, preview and actual MP4 export", async () => {
      report.offline = true;
      for (const session of [undefined, ...sessions]) await goOffline(session);
      assert.equal(await evaluate("navigator.onLine"), false);
      const result = await evaluate(`(async()=>{
        gate.s().updateTextContent(gate.s().getAllTextClips().find(c=>c.text==='Edited manual caption').id,'Offline caption');await gate.s().undo();await gate.s().redo();
        const p=gate.s().getFullProject();const frame=await gate.engines.getState().videoEngine.renderFrame(p,0.75,640,360);frame.image.close();
        const chunks=[];let position=0;const writable={async seek(p){position=p},async write(data){const bytes=new Uint8Array(await new Blob([data]).arrayBuffer());chunks.push({position,bytes});position+=bytes.length},async close(){},async abort(){throw new Error('Export aborted')}};
        const settings={format:'mp4',codec:'h264',width:640,height:360,frameRate:24,bitrate:2000,bitrateMode:'cbr',encodeMode:'balanced',quality:90,keyframeInterval:60,audioSettings:{format:'aac',sampleRate:48000,channels:2,bitDepth:16,bitrate:192}};
        const generator=gate.engines.getState().getExportEngine().exportVideo(p,settings,writable);let result;while(true){const next=await generator.next();if(next.done){result=next.value;break}}gate.assert(result.success,JSON.stringify(result));
        const size=Math.max(...chunks.map(c=>c.position+c.bytes.length));const bytes=new Uint8Array(size);for(const c of chunks)bytes.set(c.bytes,c.position);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);gate.output=btoa(binary);
        return {bytes:size,offline:!navigator.onLine,tracks:p.timeline.tracks.length};
      })()`);
      writeFileSync(join(directory, "trimmed.mp4"), Buffer.from(await evaluate("gate.output"), "base64"));
      run(process.execPath, ["apps/web/scripts/validate-browser-export.mjs", "verify", "trim-start", join(directory, "trimmed.mp4")]);
      const decoded = spawnSync("ffmpeg", ["-v", "error", "-ss", "0.75", "-i", join(directory, "trimmed.mp4"), "-frames:v", "1", "-pix_fmt", "rgba", "-f", "rawvideo", "pipe:1"], { maxBuffer: 4 * 1024 * 1024 });
      assert.equal(decoded.status, 0, String(decoded.stderr));
      const actual = decoded.stdout, expected = readFileSync(join(directory, "preview.rgba"));
      assert.equal(actual.length, 640 * 360 * 4); assert.equal(expected.length, actual.length);
      let error = 0, samples = 0, titlePixels = 0;
      for (let y = 140; y < 220; y++) for (let x = 200; x < 440; x++) {
        const i = (y * 640 + x) * 4;
        for (let channel = 0; channel < 3; channel++) { error += Math.abs(actual[i + channel] - expected[i + channel]); samples++; }
        if (actual[i] > 210 && actual[i + 1] < 50 && actual[i + 2] > 210) titlePixels++;
      }
      result.meanTitleRgbError = error / samples; result.exportTitlePixels = titlePixels;
      assert.ok(titlePixels > 400, "Exported title invisible"); assert.ok(result.meanTitleRgbError < 15, "Preview/export title mismatch");
      return result;
    });
    await check("offline export dialog and downloaded MP4", async () => {
      await evaluate(`(async()=>{gate.click('Export');await gate.pause(300);gate.click('Custom Settings');await gate.pause(300);gate.click('Export Video')})()`);
      const downloaded = await waitForDownload(".mp4");
      const validation = JSON.parse(run(process.execPath, ["apps/web/scripts/validate-browser-export.mjs", "verify", "trim-start", downloaded]));
      return {path:downloaded,bytes:validation.bytes,passed:validation.passed};
    });
    await check("offline motion render queue download", () => evaluate(`(async()=>{
      const composition=gate.s().project.motionCompositions[0];
      const id=gate.motion.getState().addRenderQueueItem({compositionId:composition.id,name:composition.name,width:composition.width,height:composition.height,frameRate:composition.frameRate,duration:0.1,format:'png-sequence',range:{startTime:0,endTime:0.1}});
      const result=await gate.queue({project:gate.s().getFullProject(),compositions:[composition]});
      gate.assert(result.outcomes.find(o=>o.itemId===id)?.status==='complete',JSON.stringify(result));
      return result;
    })()`));
    await waitForDownload(".zip");
    await check("actual reload and recovery dialog", async () => {
      const expected = await evaluate(`(async()=>{await gate.s().forceSave();const p=gate.s().getFullProject();return {id:p.id,timeline:p.timeline,creation:p.creation,motionCompositions:p.motionCompositions,generatedShaders:p.generatedShaders,textClips:p.textClips,media:p.mediaLibrary.items.map(m=>({id:m.id,type:m.type,size:m.blob?.size}))}})()`);
      report.probes.push(await evaluate("window.__releaseProbe"));
      report.offline = false;
      for (const session of sessions) await send("Network.setBlockedURLs", { urls: [] }, session);
      await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await send("Page.reload");
      await waitFor("document.body?.innerText.includes('Recover Your Work')");
      await evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Recover Project');if(!button)throw new Error('No recovery button');button.click()})()`);
      await waitFor("document.body?.innerText.includes('Export') && !document.body.innerText.includes('Recover Your Work')");
      const actual = await evaluate(`(async()=>{const {useProjectStore}=await import('/src/stores/project-store.ts');const p=useProjectStore.getState().getFullProject();return {id:p.id,timeline:p.timeline,creation:p.creation,motionCompositions:p.motionCompositions,generatedShaders:p.generatedShaders,textClips:p.textClips,media:p.mediaLibrary.items.map(m=>({id:m.id,type:m.type,size:m.blob?.size}))}})()`);
      assert.deepEqual(actual, expected);
      return {recoveryDialog:true,mediaBytes:true,currentContentUnchanged:true};
    });
    await Promise.all(instrumentation);
    report.probes.push(await evaluate("window.__releaseProbe"));
    await check("request, worker, permission and data-safety absence", async () => {
      assert.deepEqual(report.requests.filter((entry) => retiredResource.test(entry.url)), []);
      assert.deepEqual(report.workers.filter((entry) => retiredResource.test(entry.url)), []);
      for (const probe of report.probes) {
        assert.deepEqual(probe.workers.filter((url) => retiredResource.test(url)), []);
        assert.deepEqual(probe.databases.filter((name) => retiredResource.test(name)), []);
        assert.deepEqual(probe.deletes, []); assert.deepEqual(probe.permissions, []);
      }
      assert.deepEqual(report.exceptions, []);
      assert.equal(await evaluate("localStorage.getItem('release-unrelated')"), "preserved");
      assert.equal(retiredUI.test(await evaluate("document.body.innerText")), false);
      return {requests:report.requests.length,workers:report.workers.length,noPermissions:true,noDatabaseDeletion:true};
    });
    report.passed = true;
  } catch (error) {
    report.error = error.stack ?? String(error);
    if (ws?.readyState === WebSocket.OPEN) report.failureUI = await evaluate("({body:document.body.innerText,exportState:window.gate?.ui.getState().exportState,probe:window.__releaseProbe})").catch(() => null);
    throw error;
  } finally {
    writeFileSync(join(directory, "report.json"), json(report));
    ws?.close();
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error("Browser validation ended")); }
    browser.kill(); server.kill(); closeSync(log);
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateRelease({ directory: process.argv.slice(2).find((arg) => arg !== "--compact"), compact: process.argv.includes("--compact") }).catch((error) => { console.error(error); process.exitCode = 1; });
}
