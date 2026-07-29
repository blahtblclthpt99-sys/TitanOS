import{k as r}from"./index-eCOcSDB4.js";/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a=[["polyline",{points:"22 7 13.5 15.5 8.5 10.5 2 17",key:"126l90"}],["polyline",{points:"16 7 22 7 22 13",key:"kwv8wd"}]],p=r("TrendingUp",a);function i(n){return n.filter(t=>t.status==="paid").reduce((t,e)=>t+(e.total||0),0)}function c(n){return n.reduce((t,e)=>t+(e.amount||0),0)}function d(n){return n.filter(t=>["sent","viewed","overdue"].includes(t.status)).reduce((t,e)=>t+(e.balance_due||0),0)}function m(n){const t=n.reduce((e,o)=>{const s=o.category||"other";return e[s]=(e[s]||0)+(o.amount||0),e},{});return Object.entries(t).map(([e,o])=>({name:e,value:o}))}function y(n,t){const e=i(n),o=c(t),s=e-o,u=d(n);return{totalRevenue:e,totalExpenses:o,profit:s,outstanding:u}}export{p as T,m as a,y as b,i as c,c as d,d as s};
