import { loadBinary } from './load-data.js';
const $=id=>document.getElementById(id);
let worker=null,busy=false,ready=false,runs=[],lastTrial=null,loadController=null,watchdog=null;
let manifest,positions,neurons,activity=null,mapMode='region',yaw=.1,pitch=-.22,zoom=1,drag=null,dirty=true;
const canvas=$('brain'),ctx=canvas.getContext('2d');
const palette=['#afa2f2','#8fddea','#a2c498','#d9bf87','#ee99af','#f5ad87','#9bbaed','#7a889a'];
const ntColors=['#8fddea','#afa2f2','#e49dc4','#ffa886','#eec87f','#acd7a5','#718096'];
const fmt=n=>n.toLocaleString('en-US');
async function unpack(url){return loadBinary(url,{signal:loadController?.signal})}
function project(i,w,h){const x=(positions[i*3]-manifest.center[0])/manifest.span[0], y=(positions[i*3+1]-manifest.center[1])/manifest.span[0],z=(positions[i*3+2]-manifest.center[2])/manifest.span[0];const xx=x*Math.cos(yaw)+z*Math.sin(yaw),zz=-x*Math.sin(yaw)+z*Math.cos(yaw);return [w*.5+xx*w*.9*zoom,h*.48+(y*Math.cos(pitch)-zz*Math.sin(pitch))*w*.9*zoom,zz]}
function sizeCanvas(c){const box=c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);if(c.width!==Math.round(box.width*dpr)||c.height!==Math.round(box.height*dpr)){c.width=Math.round(box.width*dpr);c.height=Math.round(box.height*dpr)}return [box.width,box.height,dpr]}
function drawBrain(){if(!positions||!neurons)return;const [w,h,dpr]=sizeCanvas(canvas);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const stride=w<450?5:3;ctx.globalAlpha=.55;for(let i=0;i<manifest.neurons;i+=stride){const [x,y,z]=project(i,w,h);if(!Number.isFinite(x))continue;const a=activity?.[i]||0;ctx.fillStyle=mapMode==='transmitter'?ntColors[neurons[i][4]]:mapMode==='activity'?'#52627c':palette[neurons[i][3]];ctx.globalAlpha=mapMode==='activity'?.19:.42+Math.max(-.1,Math.min(.15,z*.4));ctx.fillRect(x,y,1.2,1.2)}if(activity){ctx.fillStyle='#ffad8d';ctx.globalAlpha=.9;for(let i=0;i<activity.length;i++){if(!activity[i])continue;const [x,y]=project(i,w,h);if(!Number.isFinite(x))continue;ctx.fillRect(x,y,Math.min(3,1.2+Math.log1p(activity[i])*.35),Math.min(3,1.2+Math.log1p(activity[i])*.35))}}ctx.globalAlpha=1}
function render(){if(dirty){drawBrain();dirty=false}requestAnimationFrame(render)}requestAnimationFrame(render);
new ResizeObserver(()=>{dirty=true;drawTrace()}).observe(canvas);
canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId)};
canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;yaw+=dx*.007;pitch+=dy*.007;drag.x=e.clientX;drag.y=e.clientY;dirty=true};
canvas.onpointerup=e=>{if(drag&&!drag.moved&&positions){const r=canvas.getBoundingClientRect();let best=-1,dist=100;for(let i=0;i<manifest.neurons;i++){const [x,y]=project(i,r.width,r.height),d=(x-e.clientX+r.left)**2+(y-e.clientY+r.top)**2;if(d<dist){best=i;dist=d}}if(best>=0){const n=neurons[best];$('selected-cell').innerHTML=`<button class="quiet" id="hide-cell">×</button><strong>${escapeHTML(n[1])}</strong> · ${escapeHTML(n[2]||'side unspecified')}<br><a target="_blank" rel="noopener" href="https://codex.flywire.ai/app/cell_details?root_id=${n[0]}">${n[0]} ↗</a><br>${escapeHTML(manifest.classes[n[3]])} · ${escapeHTML(manifest.transmitters[n[4]])}${activity?` · ${activity[best]} spikes`:''}`;$('selected-cell').hidden=false;$('hide-cell').onclick=()=>{$('selected-cell').hidden=true}}}drag=null};
canvas.onwheel=e=>{e.preventDefault();zoom=Math.max(.45,Math.min(3,zoom*Math.exp(-e.deltaY*.001)));dirty=true};
canvas.onkeydown=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')yaw-=.1;if(e.key==='ArrowRight')yaw+=.1;if(e.key==='ArrowUp')pitch-=.1;if(e.key==='ArrowDown')pitch+=.1;if(e.key==='+')zoom=Math.min(3,zoom*1.1);if(e.key==='-')zoom=Math.max(.45,zoom/1.1);dirty=true}};
$('reset-view').onclick=()=>{yaw=.1;pitch=-.22;zoom=1;dirty=true};$('color-by').onchange=e=>{mapMode=e.target.value;dirty=true};
$('rate').oninput=e=>$('rate-value').textContent=`${e.target.value} Hz`;$('gain').oninput=e=>$('gain-value').textContent=`${e.target.value}%`;
$('sources-btn').onclick=()=>$('sources-dialog').showModal();$('close-sources').onclick=()=>$('sources-dialog').close();$('sources-dialog').onclick=e=>{if(e.target===$('sources-dialog'))$('sources-dialog').close()};
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function drawTrace(){
  const c=$('trace');if(!c)return;
  const [w,h,dpr]=sizeCanvas(c),x=c.getContext('2d');
  x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
  const left=47,right=w-20,top=30,bottom=h-30;
  const max=Math.max(1,...runs.flatMap(r=>Array.from(r.bins)));
  x.font='11px system-ui';
  for(let i=0;i<=3;i++){
    const y=bottom-(bottom-top)*i/3;
    x.strokeStyle='#273344';x.beginPath();x.moveTo(left,y);x.lineTo(right,y);x.stroke();
    x.fillStyle='#8a9bb2';x.fillText(String(Math.round(max*i/3)),8,y+4);
  }
  runs.forEach((r,k)=>{
    x.strokeStyle=k?'#ffad8d':'#8fddea';x.lineWidth=k?2:2.5;x.setLineDash(k?[5,3]:[]);x.beginPath();
    r.bins.forEach((n,i)=>{const px=left+(right-left)*(i+.5)/r.bins.length,py=bottom-(bottom-top)*n/max;if(i===0)x.moveTo(px,py);else x.lineTo(px,py)});x.stroke();
  });x.setLineDash([]);x.fillStyle='#8a9bb2';x.fillText('spikes / 10 ms',18,17);x.fillText('0',left,h-10);
  x.fillText(runs.length?`${runs[0].duration} ms`: 'simulated time',right-65,h-10);
}

const evidence={
 control:{title:'Start with a control',badge:'Circuit model',summary:'Trace how simulated electrical activity travels through the actual fly wiring. Every comparison begins from rest with the same input and random seed.',can:'Compare specified circuit interventions under a simplified electrical model.',unknown:'Drug-specific receptor effects, whole-body movement, and subjective experience are not modeled.',links:[['Published circuit model','https://www.nature.com/articles/s41586-024-07763-9']]},
 lsd:{title:'LSD / acid',badge:'Fly evidence · incomplete mechanism',summary:'Published research reports changes in fly visual processing, locomotion, and gene expression after LSD. It does not supply a complete map of drug effects on each cell.',can:'Explore a circuit hypothesis against a matched control. Selecting LSD does not add a drug effect to the model.',unknown:'Fly receptor expression, binding, brain exposure, and cell-specific signaling are not sufficiently parameterized here to predict LSD effects.',links:[['LSD behavior study · 2002','https://pubmed.ncbi.nlm.nih.gov/12435434/']]},
 psilocybin:{title:'Psilocybin / mushrooms',badge:'Fly evidence · incomplete mechanism',summary:'An adult fly study measured behavioral changes after psilocybin, with differences by sex, strain, and endpoint. Those measurements do not define a complete acute neural simulation.',can:'Explore explicit circuit changes. Psilocybin and its active metabolite psilocin are distinct; a mushroom mixture is not modeled.',unknown:'Conversion, exposure, receptor distributions, and cell-specific effects. This model does not simulate subjective seeing.',links:[['Psilocybin fly study · 2022','https://pmc.ncbi.nlm.nih.gov/articles/PMC9200711/']]},
 dmt:{title:'N,N-DMT',badge:'Native fly mechanism not mapped',summary:'Mammalian receptor findings can suggest hypotheses, but cannot be copied directly onto fly neurons. No complete adult fly parameter set has been established for this app.',can:'Test a circuit intervention you specify. It remains a hypothesis, not a measured DMT response.',unknown:'A measured chain from native fly receptors through signaling and brain exposure to circuit activity.',links:[['Receptor structure study · 2025','https://www.nature.com/articles/s41467-025-57956-7']]},
 '2cb':{title:'2C-B',badge:'Native fly mechanism not mapped',summary:'Human receptor measurements do not establish potency or signaling at the fly’s receptors. This build does not contain a validated 2C-B model.',can:'Compare an explicit circuit intervention with control; drug identity is recorded as the research topic only.',unknown:'Native fly targets, functional activation, receptor locations, and exposure over time.',links:[['Human receptor screening · 2010','https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0009019']]},
 salvinorin:{title:'Salvinorin A / salvia',badge:'Native fly mechanism not mapped',summary:'Salvinorin A activates mammalian kappa-opioid receptors. That does not establish a corresponding sensitive pathway in a native fly.',can:'Explore a specified circuit hypothesis without assuming mammalian receptors are present in the fly.',unknown:'A supported native fly receptor pathway and its cellular effects. Unknown does not mean the compound has no effect.',links:[['Salvinorin A receptor study · 2002','https://pubmed.ncbi.nlm.nih.gov/12192085/']]},
};

function updateEvidence(){
  const key=$('compound').value,e=evidence[key];
  $('evidence-title').textContent=e.title;$('evidence-badge').textContent=e.badge;$('evidence-badge').classList.toggle('uncertain',key!=='control');
  $('evidence-summary').textContent=e.summary;$('evidence-can').textContent=e.can;$('evidence-unknown').textContent=e.unknown;
  $('evidence-sources').innerHTML=e.links.map(([title,url])=>`<a href="${url}" target="_blank" rel="noopener">${title} ↗</a>`).join('');
  $('compound-status').textContent=key==='control'?'Run a control, or compare it with the circuit change below.':'Research topic only. No drug effect is assigned. A comparison applies only your explicit circuit hypothesis.';
}

function setBusy(value){
  busy=value;
  for(const id of ['compound','stimulus','rate','duration','seed','target','gain'])$(id).disabled=value;
  $('run').disabled=value||!ready;$('compare').disabled=value||!ready;
  $('cancel').hidden=!value;$('progress').hidden=!value;
  $('export').disabled=value||runs.length===0;
}
function status(text,error=false){$('run-status').textContent=text;$('run-status').classList.toggle('error',error)}
function fail(error){clearTimeout(watchdog);setBusy(false);status(error.message||String(error),true);$('retry').hidden=false;$('retry').textContent=ready?'Retry trial':'Retry loading'}
function resetWatchdog(){clearTimeout(watchdog);watchdog=setTimeout(()=>{worker?.terminate();worker=null;fail(new Error('The circuit engine stopped responding. Retry the trial.'));},60000)}
function makeWorker(){
  if(worker)return worker;
  worker=new Worker(new URL('./circuit-worker.js',import.meta.url),{type:'module'});
  worker.onerror=e=>{worker?.terminate();worker=null;fail(new Error(e.message||'The circuit engine could not start. Please redeploy all files, including circuit-worker.js.'))};
  worker.onmessage=({data})=>{
    resetWatchdog();
    if(data.type==='loading'){$('progress').value=Math.round(data.progress*100);status(data.message+' · first run only')}
    if(data.type==='loaded')status('Connections loaded. Starting trial…');
    if(data.type==='progress'){$('progress').value=Math.round(data.overall*100);status(data.message)}
    if(data.type==='result'){runs[data.run]=data.result;showResults()}
    if(data.type==='done'){
      clearTimeout(watchdog);setBusy(false);
      const neutral=runs.length===2&&lastTrial.gain===1;
      status(runs.length===2?(neutral?'Comparison complete. At 100% strength the hypothesis is identical to control.':'Comparison complete. The changed curve is your circuit hypothesis, not a predicted drug response.'):'Control complete. Adjust a circuit hypothesis to compare.');
    }
    if(data.type==='error')fail(new Error(data.message));
    if(data.type==='cancelled'){clearTimeout(watchdog);runs=[];activity=null;dirty=true;showResults();setBusy(false);status('Trial cancelled. Ready to run again.')}
  };return worker;
}

function currentConfig(){
  const input=manifest.presets[$('stimulus').value]||[];
  const target=$('target').value;
  let targets=[];
  if(target==='input')targets=[...input];
  if(target==='mn9'&&Number.isInteger(manifest.mn9))targets=[manifest.mn9];
  if(target==='optic')targets=neurons.flatMap((n,i)=>n[3]===manifest.classes.indexOf('optic')?[i]:[]);
  if(target==='serotonin'||target==='dopamine')targets=neurons.flatMap((n,i)=>n[4]===manifest.transmitters.indexOf(target)?[i]:[]);
  return {input,targets,duration:Number($('duration').value),rate:Number($('rate').value),seed:Number($('seed').value),gain:Number($('gain').value)/100,compound:$('compound').value,stimulus:$('stimulus').value,target,pharmacologyApplied:false};
}
async function startTrial(compare=false){
  if(!ready||busy)return;
  const config=currentConfig();
  if(!Number.isInteger(config.seed)||config.seed<1||config.seed>2147483647){status('Enter a whole-number seed between 1 and 2147483647.',true);return}
  lastTrial={...config,compare};runs=[];activity=null;dirty=true;showResults();$('retry').hidden=true;
  setBusy(true);$('progress').value=0;status('Preparing the circuit engine…');resetWatchdog();
  try{makeWorker().postMessage({type:'run',manifest,trials:[{...config,gain:1,targets:[]},...(compare?[config]:[])]})}catch(e){fail(e)}
}
function showResults(){
  const current=runs[runs.length-1];
  activity=current?.counts||null;dirty=true;
  if(current){mapMode='activity';$('color-by').value='activity'}
  $('map-caption-title').textContent=current?`Total spike counts · ${runs.length===2?'hypothesis':'control'}`:'Anatomical reference points';
  $('result-title').textContent=runs.length===2?'Control & circuit hypothesis':'Circuit activity';
  $('result-context').textContent=current?`${current.duration} ms · seed ${current.seed}${runs.length===2?' · matched input':''}`:'Run a trial to measure a response';
  const metric=(key,index)=>runs.map(r=>fmt(index===undefined?r[key]:(r.counts[index]||0))).join(' → ')||'—';
  $('result-metrics').innerHTML=`<div><strong>${metric('total')}</strong><span>spikes${runs.length===2?' · control → hypothesis':''}</span></div><div><strong>${metric('responding')}</strong><span>cells responding</span></div><div><strong>${Number.isInteger(manifest?.mn9)?metric(null,manifest.mn9):'—'}</strong><span>MN9 spikes</span></div>`;
  $('result-note').textContent='Simulated electrical activity only. Direct circuit interventions are not drug mechanisms; spike counts do not establish movement or subjective vision.';
  $('ranked-results').hidden=!current;
  if(current){const top=[];current.counts.forEach((n,i)=>{if(n)top.push([i,n])});top.sort((a,b)=>b[1]-a[1]);$('ranked-table').innerHTML='<table><thead><tr><th>Cell type</th><th>Root ID</th><th>Spikes</th></tr></thead><tbody>'+top.slice(0,12).map(([i,n])=>`<tr><td>${escapeHTML(neurons[i][1])}</td><td>${neurons[i][0]}</td><td>${n}</td></tr>`).join('')+'</tbody></table>'}
  drawTrace();
}
function exportTrial(){
  if(!runs.length||busy)return;
  const result={app:'Fly Circuit Lab 0.2.0',createdAt:new Date().toISOString(),interpretation:'Simplified electrical circuit model. Compound is a research topic only; pharmacologyApplied is false. No movement or subjective vision model.',dataset:{version:manifest.version,neurons:manifest.neurons,connections:manifest.connections,source:manifest.source,source_sha256:manifest.source_sha256},setup:lastTrial,results:runs.map((r,k)=>({label:k?'circuit hypothesis':'control',total:r.total,responding:r.responding,duration:r.duration,seed:r.seed,binMs:r.binMs,bins:Array.from(r.bins),parameters:r.parameters,activeCells:Array.from(r.counts).flatMap((count,i)=>count?[{rootId:neurons[i][0],type:neurons[i][1],spikes:count}]:[])}))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`fly-circuit-trial-${lastTrial.seed}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

$('compound').onchange=updateEvidence;
$('stimulus').onchange=()=>{const key=$('stimulus').value,n=manifest?.presets[key]?.length||0;$('stimulus-note').textContent=key==='none'?'No cells are stimulated; a model initialized at rest should stay quiet.':key==='sugar'?`Direct input to ${n} sugar-sensing cells matched to this dataset.`:`Direct input to ${n} identified motion cells. This is not a retinal image simulation.`};
$('run').onclick=()=>startTrial(false);$('compare').onclick=()=>startTrial(true);$('export').onclick=exportTrial;
$('cancel').onclick=()=>{status('Cancelling trial…');worker?.postMessage({type:'cancel'})};
$('retry').onclick=()=>{if(ready)startTrial(lastTrial?.compare||false);else init()};

async function init(){
  $('retry').hidden=true;ready=false;setBusy(false);status('Loading neuron map…');loadController?.abort();loadController=new AbortController();
  try{
    const response=await fetch('data/manifest.json',{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(`Could not load the data manifest (HTTP ${response.status}).`);
    manifest=await response.json();
    const [p,n]=await Promise.all([unpack('data/positions.bin.gz'),unpack('data/neurons.json.gz')]);
    positions=new Float32Array(p);neurons=JSON.parse(new TextDecoder().decode(n));
    if(positions.length!==manifest.neurons*3||neurons.length!==manifest.neurons)throw new Error('Neuron data are incomplete. Redeploy all files in the package.');
    $('map-loading').hidden=true;$('neuron-count').textContent=fmt(manifest.neurons);$('edge-count').textContent=(manifest.connections/1e6).toFixed(2)+'M';$('contact-count').textContent=(manifest.synaptic_contacts/1e6).toFixed(2)+'M';
    $('stimulus').options[0].textContent=`Sugar-sensing · ${manifest.presets.sugar.length} cells`;
    ready=true;setBusy(false);status('Ready. Connections load on the first run (about 54 MB).');dirty=true;drawTrace();updateEvidence();$('stimulus').onchange();
    $('model-details').innerHTML=`<p>${fmt(manifest.neurons)} neurons, ${fmt(manifest.connections)} connection records, ${fmt(manifest.synaptic_contacts)} synaptic contacts.</p><h3>Electrical model</h3><p>Browser adaptation of the Shiu-style leaky integrate-and-fire model. Step: 0.1 ms. Rest/reset: −52 mV. Threshold: −45 mV. Membrane time constant: 20 ms; synaptic decay: 5 ms; delay: 1.8 ms; refractory period: 2.2 ms (zero for stimulated cells). Signed weight: 0.275 mV per contact. Cells begin at rest. Seeded Bernoulli input approximates a Poisson process at each step.</p><p>Voltage and synaptic drive use an exact linear update between discrete events. There are no receptor dynamics, gap junctions, or pharmacokinetics. Selecting a compound changes evidence notes only. A hypothesis scales outgoing weights for the explicitly selected cells. This is not an exact reproduction of Brian2 scheduling or a validated prediction of drug-exposed fly behavior.</p><h3>Anatomical data</h3><p>${manifest.coordinate_note}</p><p>${manifest.graph_note}</p><p><a href="${manifest.source}" target="_blank" rel="noopener">Original model and wiring data</a> · <a href="${manifest.annotations_source}" target="_blank" rel="noopener">Neuron annotations</a></p>`;
  }catch(e){loadController.abort();$('map-loading').hidden=false;$('map-loading').textContent='Could not load the brain map.';fail(e)}
}
window.flyLab={getState:()=>({loaded:ready,busy,neurons:manifest?.neurons,connections:manifest?.connections,status:$('run-status').textContent,results:runs.map(r=>({total:r.total,responding:r.responding,duration:r.duration,seed:r.seed,mn9:r.counts[manifest.mn9],bins:Array.from(r.bins)}))})};
init();
