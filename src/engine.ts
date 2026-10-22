export type Kind = 'screen'|'input'|'button'|'auth'|'condition'|'api'|'database'|'math'|'class'|'reset'|'navigate'|'text'|'textarea'|'select'|'checkbox'|'divider'|'constant'|'variable'|'validation'|'transform'|'notify'|'logout';
export type Block = {id:string; type?:string; position:{x:number;y:number}; data:{kind:Kind; label:string; config:Record<string,string>}};
export type ScreenRoute={id:string;trigger:string;when:'true'|'false'|'always';target:string};
export function screenRoutes(screen:Block):ScreenRoute[]{
 const routes=JSON.parse(screen.data.config.routes||'[]');
 if(!Array.isArray(routes)||routes.some(r=>!r||typeof r.id!=='string'||typeof r.trigger!=='string'||!['true','false','always'].includes(r.when)||typeof r.target!=='string'))throw Error('Transições de tela inválidas');
 return routes;
}
export function reachableActions(g:Graph,screenId:string):Block[]{const visited=new Set<string>();const pending=g.nodes.filter(n=>n.data.kind==='button'&&n.data.config.screenId===screenId).map(n=>n.id);while(pending.length){const id=pending.shift()!;if(visited.has(id))continue;visited.add(id);g.edges.filter(e=>e.source===id&&['next','true','false'].includes(e.sourceHandle||'')).forEach(e=>pending.push(e.target));}return g.nodes.filter(n=>visited.has(n.id)&&n.data.kind!=='screen'&&ports(n.data.kind).outputs.some(p=>['next','true','false'].includes(p)));}
export type Link = {id:string;source:string;target:string;sourceHandle?:string|null;targetHandle?:string|null};
export type Graph = {version:1;name:string;nodes:Block[];edges:Link[]};
export type Trace = {id:string;label:string;message:string};
export type Result = {trace:Trace[];messages:string[];screen?:string;outputs:Record<string,unknown>};
export const catalog:Record<Kind,{name:string;category:string;description:string;icon:string;color:string;defaults:Record<string,string>}> = {
text:{"name": "Texto / título", "category": "Interface", "description": "Título, parágrafo ou legenda", "icon": "H", "color": "#8d9aff", "defaults": {"screenId": "", "text": "Seu texto aqui", "style": "paragraph"}},
textarea:{"name": "Área de texto", "category": "Interface", "description": "Entrada com várias linhas", "icon": "☰", "color": "#8d9aff", "defaults": {"screenId": "", "placeholder": "Escreva aqui", "value": ""}},
select:{"name": "Lista de seleção", "category": "Interface", "description": "Escolher uma opção de uma lista", "icon": "▾", "color": "#8d9aff", "defaults": {"screenId": "", "options": "Opção 1,Opção 2,Opção 3", "value": "Opção 1"}},
checkbox:{"name": "Caixa de seleção", "category": "Interface", "description": "Alternar verdadeiro e falso", "icon": "☑", "color": "#8d9aff", "defaults": {"screenId": "", "value": "false"}},
divider:{"name": "Separador", "category": "Interface", "description": "Divisão visual entre elementos", "icon": "―", "color": "#8d9aff", "defaults": {"screenId": ""}},
constant:{"name": "Valor constante", "category": "Dados", "description": "Texto, número, booleano ou JSON", "icon": "#", "color": "#7fc7ed", "defaults": {"value": "Olá", "valueType": "text"}},
variable:{"name": "Variável", "category": "Lógica", "description": "Ler ou definir valor em memória", "icon": "x", "color": "#f4bf70", "defaults": {"key": "minhaVariavel", "operation": "set", "value": ""}},
validation:{"name": "Validar campo", "category": "Lógica", "description": "Obrigatório, e-mail, tamanho ou número", "icon": "✓", "color": "#f4bf70", "defaults": {"rule": "required", "minimum": "6"}},
transform:{"name": "Transformar texto", "category": "Lógica", "description": "Maiúsculas, minúsculas, limpar ou juntar", "icon": "Aa", "color": "#f4bf70", "defaults": {"operation": "trim", "suffix": "", "value": ""}},
notify:{"name": "Mensagem / alerta", "category": "Lógica", "description": "Exibir mensagem ao usuário", "icon": "!", "color": "#f4bf70", "defaults": {"message": "Operação concluída"}},
logout:{"name": "Encerrar sessão", "category": "Lógica", "description": "Limpar a sessão simulada", "icon": "⇥", "color": "#f4bf70", "defaults": {}},
 screen:{name:'Tela',category:'Interface',description:'Uma página do seu aplicativo',icon:'▣',color:'#8d9aff',defaults:{title:'Nova tela',routes:'[]'}},
 input:{name:'Campo de entrada',category:'Interface',description:'Texto, e-mail, senha ou número',icon:'T',color:'#8d9aff',defaults:{field:'text',placeholder:'Digite aqui',screenId:'',value:''}},
 button:{name:'Botão',category:'Interface',description:'Dispara um fluxo de ações',icon:'↗',color:'#8d9aff',defaults:{screenId:''}},
 auth:{name:'Autenticação',category:'Lógica',description:'Entrar ou criar uma conta simulada',icon:'⌘',color:'#b99bff',defaults:{provider:'email',mode:'login'}},
 condition:{name:'Condição',category:'Lógica',description:'Escolha entre dois caminhos',icon:'◇',color:'#f4bf70',defaults:{operator:'truthy',compare:''}},
 math:{name:'Operação matemática',category:'Lógica',description:'Somar, subtrair, multiplicar ou dividir',icon:'∑',color:'#f4bf70',defaults:{operation:'add',a:'0',b:'0'}},
 navigate:{name:'Navegação',category:'Lógica',description:'Abre outra tela do projeto',icon:'→',color:'#89d5ba',defaults:{target:''}},
 reset:{name:'Redefinir senha',category:'Lógica',description:'Simula envio por e-mail, SMS ou token',icon:'↺',color:'#b99bff',defaults:{channel:'email'}},
 api:{name:'Requisição API',category:'Dados',description:'Resposta fictícia configurável',icon:'↔',color:'#7fc7ed',defaults:{method:'GET',url:'/api/example',mock:'{"ok":true}'}},
 database:{name:'Banco de dados',category:'Dados',description:'Consultar ou inserir registros em memória',icon:'▤',color:'#7fc7ed',defaults:{operation:'query',table:'users',mock:'[{"email":"demo@exemplo.com"}]'}},
 class:{name:'Classe / modelo',category:'Estrutura',description:'Nome e atributos de uma classe',icon:'{}',color:'#91cfa3',defaults:{name:'User',fields:'id,email,name'}}
};
export const demo:Graph={version:1,name:'Meu primeiro aplicativo',nodes:[
{id:'login',type:'block',position:{x:40,y:80},data:{kind:'screen',label:'Tela de login',config:{title:'Bem-vindo de volta',routes:JSON.stringify([{id:'login-success',trigger:'check',when:'true',target:'home'},{id:'google-success',trigger:'oauth',when:'true',target:'home'}])}}},
{id:'email',type:'block',position:{x:300,y:20},data:{kind:'input',label:'E-mail',config:{field:'email',placeholder:'voce@exemplo.com',screenId:'login',value:''}}},
{id:'password',type:'block',position:{x:300,y:240},data:{kind:'input',label:'Senha',config:{field:'password',placeholder:'Sua senha',screenId:'login',value:''}}},
{id:'enter',type:'block',position:{x:40,y:310},data:{kind:'button',label:'Entrar',config:{screenId:'login'}}},
{id:'auth',type:'block',position:{x:590,y:110},data:{kind:'auth',label:'Validar acesso',config:{provider:'email',mode:'login'}}},
{id:'check',type:'block',position:{x:870,y:110},data:{kind:'condition',label:'Acesso autorizado?',config:{operator:'truthy',compare:''}}},
{id:'go',type:'block',position:{x:1150,y:60},data:{kind:'navigate',label:'Abrir início',config:{target:'home'}}},
{id:'home',type:'block',position:{x:1420,y:60},data:{kind:'screen',label:'Página inicial',config:{title:'Você chegou ao seu app',routes:JSON.stringify([{id:'logout-login',trigger:'logout-action',when:'always',target:'login'}])}}},
{id:'forgot',type:'block',position:{x:40,y:510},data:{kind:'button',label:'Esqueci minha senha',config:{screenId:'login'}}},
{id:'reset',type:'block',position:{x:590,y:440},data:{kind:'reset',label:'Enviar recuperação',config:{channel:'email'}}},
{id:'google',type:'block',position:{x:300,y:650},data:{kind:'button',label:'Continuar com Google',config:{screenId:'login'}}},
{id:'oauth',type:'block',position:{x:590,y:650},data:{kind:'auth',label:'Google OAuth',config:{provider:'google',mode:'login'}}},
{id:'signup',type:'block',position:{x:40,y:820},data:{kind:'button',label:'Criar conta',config:{screenId:'login'}}},
{id:'register',type:'block',position:{x:590,y:850},data:{kind:'auth',label:'Cadastrar usuário',config:{provider:'email',mode:'register'}}},
{id:'logout-button',type:'block',position:{x:1420,y:320},data:{kind:'button',label:'Sair da conta',config:{screenId:'home'}}},
{id:'logout-action',type:'block',position:{x:1690,y:320},data:{kind:'logout',label:'Encerrar sessão',config:{}}},
],edges:[
['logout-button','logout-action','next','exec'],['email','auth','value','email'],['password','auth','value','password'],['enter','auth','next','exec'],['auth','check','next','exec'],['auth','check','value','value'],['check','go','true','exec'],['go','home','next','exec'],['forgot','reset','next','exec'],['email','reset','value','email'],['google','oauth','next','exec'],['oauth','go','next','exec'],['signup','register','next','exec'],['email','register','value','email'],['password','register','value','password'],['register','check','next','exec'],['register','check','value','value']
].map(([source,target,sourceHandle,targetHandle],i)=>({id:'e'+i,source,target,sourceHandle,targetHandle}))};
export const interfaceKinds:Kind[]=['input','button','text','textarea','select','checkbox','divider'];
export const valueKinds:Kind[]=['input','textarea','select','checkbox','constant'];
export function inputValue(n:Block,values:Record<string,string>):unknown{const v=values[n.id]??n.data.config.value??'';if(n.data.kind==='checkbox')return v==='true';if(n.data.kind==='constant'){const type=n.data.config.valueType;return type==='number'?Number(v):type==='boolean'?v==='true':type==='json'?JSON.parse(v):v;}return v;}
export function ports(kind:Kind):{inputs:string[];outputs:string[]}{
 if(valueKinds.includes(kind))return {inputs:[],outputs:['value']};
 if(['text','divider'].includes(kind))return {inputs:[],outputs:[]};
 if(kind==='validation')return {inputs:['exec','value'],outputs:['true','false','value']};
 if(['variable','transform','notify'].includes(kind))return {inputs:['exec','value'],outputs:['next','value']};
 const inputs:Partial<Record<Kind,string[]>>={input:[],screen:['exec'],button:[],class:[],auth:['exec','email','password'],reset:['exec','email'],condition:['exec','value'],math:['exec','a','b'],api:['exec','body'],database:['exec','value'],navigate:['exec']};
 const outputs = kind==='input'?['value']:kind==='class'?[]:kind==='condition'?['true','false','value']:kind==='screen'?[]:['next','value'];
 return {inputs:inputs[kind]||['exec'],outputs};
}
export function validate(g:Graph):string[]{
 const errors:string[]=[];const ids=new Set(g.nodes.map(n=>n.id));
 if(ids.size!==g.nodes.length)errors.push('IDs de blocos duplicados.');
 for(const n of g.nodes){if(!catalog[n.data.kind]){errors.push('Tipo de bloco desconhecido.');continue;}const c=n.data.config;
 if(interfaceKinds.includes(n.data.kind)&&!g.nodes.some(x=>x.id===c.screenId&&x.data.kind==='screen'))errors.push(`${n.data.label}: selecione uma tela.`);
 if(n.data.kind==='screen'){try{const routes=screenRoutes(n);const available=reachableActions(g,n.id);for(const r of routes){if(!available.some(a=>a.id===r.trigger))errors.push(`${n.data.label}: escolha um evento conectado a um botão desta tela.`);if(!g.nodes.some(t=>t.id===r.target&&t.data.kind==='screen'))errors.push(`${n.data.label}: destino da transição não existe.`);}if(routes.some((r,i)=>routes.slice(i+1).some(t=>t.trigger===r.trigger&&(t.when===r.when||t.when==='always'||r.when==='always'))))errors.push(`${n.data.label}: transições com condições sobrepostas.`);}catch{errors.push(`${n.data.label}: transições inválidas.`)}}
 if(n.data.kind==='navigate'&&!g.nodes.some(x=>x.id===c.target&&x.data.kind==='screen'))errors.push(`${n.data.label}: selecione a tela de destino.`);
 if(n.data.kind==='constant'&&c.valueType==='json'){try{JSON.parse(c.value)}catch{errors.push(`${n.data.label}: JSON inválido.`)}}
 if(n.data.kind==='constant'&&c.valueType==='number'&&!Number.isFinite(Number(c.value)))errors.push(`${n.data.label}: informe um número.`);
 if(n.data.kind==='validation'&&c.rule==='minLength'&&(!Number.isFinite(Number(c.minimum))||Number(c.minimum)<0))errors.push(`${n.data.label}: tamanho mínimo inválido.`);
 if(['api','database'].includes(n.data.kind)){try{JSON.parse(c.mock)}catch{errors.push(`${n.data.label}: JSON inválido.`)}}
 }
 for(const e of g.edges){const a=g.nodes.find(n=>n.id===e.source),b=g.nodes.find(n=>n.id===e.target);if(!a||!b){errors.push('Conexão com bloco inexistente.');continue;}
 if(!ports(a.data.kind).outputs.includes(e.sourceHandle||'')||!ports(b.data.kind).inputs.includes(e.targetHandle||''))errors.push('Porta de conexão inválida.');
 if((e.targetHandle==='exec')!==['next','true','false'].includes(e.sourceHandle||''))errors.push('Conecte ações a ações e dados a dados.');
 }
 return [...new Set(errors)];
}
// Interpretador compartilhado pelo editor e pelo projeto TypeScript exportado.
export function run(g:Graph,start:string,values:Record<string,string>={},store:Record<string,unknown[]>={},initialScreen?:string):Result{
 const result:Result={trace:[],messages:[],outputs:{}};const outputs=result.outputs;
 const node=(id:string)=>g.nodes.find(n=>n.id===id);
 const read=(id:string,port:string,fallback:unknown='')=>{const es=g.edges.filter(e=>e.target===id&&e.targetHandle===port);const e=es.find(e=>Object.hasOwn(outputs,e.source))||es[0];if(!e)return fallback;const n=node(e.source);return n&&valueKinds.includes(n.data.kind)?inputValue(n,values):outputs[e.source]??fallback;};
 const origin=node(initialScreen||node(start)?.data.config.screenId||'');const routes=origin?.data.kind==='screen'?screenRoutes(origin):[];
 let current:string|undefined=start;let steps=0;
 while(current&&steps++<100){const n=node(current);if(!n)throw Error('Bloco não encontrado: '+current);const c=n.data.config;let out:unknown=true;let path='next';let message='Executado';
 switch(n.data.kind){
 case 'screen':result.screen=n.id;message='Tela aberta';break;
 case 'input':case 'textarea':case 'select':case 'checkbox':case 'constant':out=inputValue(n,values);break;
 case 'text':out=c.text;break;
 case 'divider':out=null;break;
 case 'variable':{const key='variable:'+c.key;if(c.operation==='set')store[key]=[read(n.id,'value',c.value)];out=store[key]?.[0]??c.value;message=(c.operation==='set'?'Definir ':'Ler ')+c.key;break;}
 case 'validation':{const value=String(read(n.id,'value'));out=c.rule==='email'?/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value):c.rule==='minLength'?value.length>=Number(c.minimum):c.rule==='number'?value.trim()!==''&&Number.isFinite(Number(value)):value.trim().length>0;path=out?'true':'false';message=out?'Validação aprovada':'Validação reprovada';break;}
 case 'transform':{const value=String(read(n.id,'value',c.value));out=c.operation==='upper'?value.toUpperCase():c.operation==='lower'?value.toLowerCase():c.operation==='concat'?value+c.suffix:value.trim();message='Texto: '+out;break;}
 case 'notify':out=String(read(n.id,'value',c.message));result.messages.push(String(out));message=String(out);break;
 case 'logout':delete store.__session;out=true;message='Sessão simulada encerrada';break;
 case 'button':message='Fluxo iniciado';break;
 case 'auth':{const email=String(read(n.id,'email')),password=String(read(n.id,'password'));if(c.provider!=='email'){out=true;message=`${c.provider}: autenticação simulada`;}else{const users=store.__users??(store.__users=[{email:'demo@exemplo.com',password:'123456'}]);if(c.mode==='register'){out=email.includes('@')&&password.length>=6&&!users.some(u=>(u as any).email===email);if(out)users.push({email,password});message=out?'Conta simulada criada':'Use e-mail novo e senha com 6 caracteres';}else{out=users.some(u=>(u as any).email===email&&(u as any).password===password);message=out?'Acesso simulado autorizado':'E-mail ou senha inválidos';}}break;}
 case 'condition':{const value=read(n.id,'value');out=c.operator==='equals'?String(value)===c.compare:c.operator==='gt'?Number(value)>Number(c.compare):Boolean(value);path=out?'true':'false';message=out?'Caminho verdadeiro':'Caminho falso';break;}
 case 'math':{const a=Number(read(n.id,'a',c.a)),b=Number(read(n.id,'b',c.b));if(!Number.isFinite(a)||!Number.isFinite(b))throw Error('Operação exige números');if(c.operation==='divide'&&b===0)throw Error('Divisão por zero');out=c.operation==='subtract'?a-b:c.operation==='multiply'?a*b:c.operation==='divide'?a/b:a+b;message='Resultado: '+out;break;}
 case 'api':out=JSON.parse(c.mock);message=`${c.method} ${c.url} · resposta simulada`;break;
 case 'database':{const rows=store[c.table]??(store[c.table]=JSON.parse(c.mock));if(!Array.isArray(rows))throw Error('Banco: use um array JSON');if(c.operation==='insert')rows.push(read(n.id,'value',{}));out=[...rows];message=`${c.table}: ${rows.length} registro(s) em memória`;break;}
 case 'reset':out=String(read(n.id,'email')).includes('@');message=out?`Recuperação por ${c.channel} simulada; nada foi enviado`:'Informe um e-mail';break;
 case 'navigate':result.screen=c.target;message='Navegando para '+(node(c.target)?.data.label||c.target);break;
 case 'class':out=Object.fromEntries(c.fields.split(',').map(f=>[f.trim(),null]));message='Modelo criado';break;
 }
 if(n.data.kind==='auth'){if(out)store.__session=[{provider:c.provider,email:read(n.id,'email')}];else delete store.__session;}
 outputs[n.id]=out;result.trace.push({id:n.id,label:n.data.label,message});
 const route=routes.find(r=>r.trigger===n.id&&(r.when==='always'||(r.when==='true'?out===true:out===false)));if(route){const target=node(route.target);if(target?.data.kind!=='screen')throw Error('Tela de destino da transição não existe');result.screen=target.id;result.trace.push({id:target.id,label:target.data.label,message:`Transição de ${origin!.data.label}: ${n.data.label} → ${target.data.label}`});return result;}
 current=g.edges.find(e=>e.source===n.id&&e.sourceHandle===path)?.target;
 }
 if(current)throw Error('Fluxo interrompido: limite de 100 passos (possível ciclo).');return result;
}
export function parseGraph(text:string):Graph {const g=JSON.parse(text);if(g.version!==1||typeof g.name!=='string'||!Array.isArray(g.nodes)||!Array.isArray(g.edges)||g.nodes.length>500||g.edges.length>2000)throw Error('Formato de projeto inválido');for(const n of g.nodes){if(typeof n.id!=='string'||!n.data||!catalog[n.data.kind as Kind]||typeof n.data.label!=='string'||!n.data.config||typeof n.data.config!=='object'||Object.values(n.data.config).some(v=>typeof v!=='string')||!Number.isFinite(n.position?.x)||!Number.isFinite(n.position?.y))throw Error('Bloco inválido');if(n.data.kind==='screen')screenRoutes(n);}for(const e of g.edges){if(typeof e.id!=='string'||typeof e.source!=='string'||typeof e.target!=='string')throw Error('Conexão inválida');}return g;}
