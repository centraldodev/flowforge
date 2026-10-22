import React from 'react';
import type {Graph} from './engine';
/** Shared by the preview and exported React app. */
export function ScreenFields({graph,screen,values,onChange,onAction}:{graph:Graph;screen?:string;values:Record<string,string>;onChange:(id:string,value:string)=>void;onAction:(id:string)=>void}){
 return <>{graph.nodes.filter(n=>n.data.config.screenId===screen).map(n=>{const c=n.data.config,value=values[n.id]??c.value??'';switch(n.data.kind){
 case 'text':return c.style==='title'?<h2 key={n.id}>{c.text}</h2>:c.style==='caption'?<small key={n.id}>{c.text}</small>:<p key={n.id}>{c.text}</p>;
 case 'divider':return <hr key={n.id}/>;
 case 'button':return <button className="primary wide" key={n.id} onClick={()=>onAction(n.id)}>{n.data.label}</button>;
 case 'checkbox':return <label className="checkbox-field" key={n.id}><input type="checkbox" checked={value==='true'} onChange={e=>onChange(n.id,String(e.target.checked))}/>{n.data.label}</label>;
 case 'select':return <label className="field" key={n.id}>{n.data.label}<select value={value} onChange={e=>onChange(n.id,e.target.value)}><option value="">Selecione...</option>{c.options.split(',').map((option,i)=><option key={i} value={option.trim()}>{option.trim()}</option>)}</select></label>;
 case 'textarea':return <label className="field" key={n.id}>{n.data.label}<textarea rows={3} placeholder={c.placeholder} value={value} onChange={e=>onChange(n.id,e.target.value)}/></label>;
 case 'input':return <label className="field" key={n.id}>{n.data.label}<input type={c.field} placeholder={c.placeholder} value={value} onChange={e=>onChange(n.id,e.target.value)}/></label>;
 default:return null;}})}</>;
}
