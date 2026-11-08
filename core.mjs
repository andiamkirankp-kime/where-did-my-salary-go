export const CATEGORIES = ['Food / Delivery', 'Groceries', 'Rent / Housing', 'EMI', 'Transport', 'Fuel', 'Shopping', 'Entertainment', 'Medical', 'Bills', 'Subscriptions', 'Personal Care', 'Travel', 'Family', 'Education', 'Other'];
export const PAYMENTS = ['UPI', 'Credit Card', 'Debit Card', 'Cash', 'Bank Transfer', 'Other'];
export const FIXED = ['Rent / Housing', 'EMI', 'Utilities', 'Internet', 'Mobile', 'Insurance', 'Subscriptions', 'Family', 'Fixed Other'];
export const VARIABLE = ['Groceries', 'Food / Delivery', 'Transport', 'Shopping', 'Entertainment', 'Medical', 'Variable Other'];
export const GOAL_PLAN = ['Savings', 'Emergency Fund', 'Investments', 'Travel', 'Other'];
export const DEFAULT_THRESHOLDS = {minBuffer: 5000, minSurplus: 3000, maxEmiPercent: 35, tightBuffer: 3000};
export const SETUP_FIXED = ['Rent / Housing','EMI','Utilities','Subscriptions','Insurance','Family','Fixed Other'];
export const SETUP_EVERYDAY = ['Groceries','Food / Delivery','Transport','Shopping','Variable Other'];
export const DAILY_CATEGORIES = CATEGORIES.filter(k=>!['Rent / Housing','EMI','Bills','Subscriptions'].includes(k));
export const billName = key => ({'Rent / Housing':'Rent / housing','EMI':'Loan EMIs','Utilities':'Household bills','Internet':'Internet','Mobile':'Mobile plan','Subscriptions':'Subscriptions','Insurance':'Insurance','Family':'Family support','Fixed Other':'Other monthly bill'}[key]||key);
export const billCategory = key => ['Utilities','Internet','Mobile','Insurance'].includes(key)?'Bills':key==='Fixed Other'?'Other':key;
export function setupDraft(name='') {return {name, salary:'',salaryDay:'',budgets:{},selectedBills:{},costsConfirmed:{fixed:false,everyday:false},plannedSavings:'',savedThisMonth:'',spentThisMonth:'',goalName:'',goalTarget:'',goalDate:''};}
export class SetupError extends Error {constructor(message,field=''){super(message);this.field=field;}}
export function validateSetupStep(draft, step, now=new Date()) {
 const present=v=>v!==undefined&&v!==null&&String(v).trim()!=='';
 const amount=(value,field,label,required=false)=>{if(!present(value)){if(required)throw new SetupError(`Enter ${label}.`,field);return;}if(!Number.isFinite(Number(value))||Number(value)<0||Number(value)>1e12)throw new SetupError(`Enter a valid ${label} of ₹0 or more.`,field);if(Math.abs(Number(value)-Math.round(Number(value)*100)/100)>1e-7)throw new SetupError('Use no more than two decimal places for money amounts.',field);};
 if(step===1){
  amount(draft.salary,'salary','your monthly take-home salary',true);
  if(Number(draft.salary)<=0)throw new SetupError('Enter a take-home salary greater than ₹0.','salary');
  if(!present(draft.salaryDay)||!Number.isInteger(Number(draft.salaryDay))||Number(draft.salaryDay)<1||Number(draft.salaryDay)>31)throw new SetupError('Enter your payday, from 1 to 31.','salaryDay');
 }
 if(step===2){
  for(const key of SETUP_FIXED){
   const selected=!!draft.selectedBills?.[key];
   amount(draft.budgets?.[key],`budget:${key}`,`${billName(key).toLowerCase()} amount`,selected);
   if(selected&&Number(draft.budgets?.[key])<=0)throw new SetupError(`Enter an amount greater than ₹0 for ${billName(key).toLowerCase()}, or uncheck it.`,`budget:${key}`);
  }
  if(!SETUP_FIXED.some(key=>Number(draft.budgets?.[key])>0)&&!draft.costsConfirmed?.fixed)throw new SetupError('Choose your monthly bills, or choose “I have no monthly bills”.');
 }
 if(step===3){
  amount(draft.plannedSavings,'plannedSavings','your monthly savings target',true);
  for(const key of ['savedThisMonth','spentThisMonth'])amount(draft[key],key,key==='savedThisMonth'?'already saved amount':'already spent amount');
  if(String(draft.goalName||'').trim()||present(draft.goalTarget)||present(draft.goalDate)){
   if(!String(draft.goalName||'').trim())throw new SetupError('Give your optional goal a name, or leave all goal fields empty.','goalName');
   amount(draft.goalTarget,'goalTarget','a goal target',true);
   if(Number(draft.goalTarget)<=0)throw new SetupError('Enter a goal target greater than ₹0.','goalTarget');
   const date=draft.goalDate;
   if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||dateISO(new Date(`${date}T12:00:00`))!==date||date<dateISO(now))throw new SetupError('Choose a goal date today or later.','goalDate');
  }
 }
 return true;
}
export function buildSetup(draft, now=new Date()) {
  for(const step of [1,2,3])validateSetupStep(draft,step,now);
  if(!Object.values(draft.budgets).every(v=>Number.isFinite(Number(v))&&Number(v)>=0) || !['plannedSavings','savedThisMonth','spentThisMonth','goalTarget'].every(k=>Number.isFinite(Number(draft[k]))&&Number(draft[k])>=0))throw new Error('Money amounts need to be zero or more.');
  const state=blankState(),key=monthKey(now);state.onboarded=true;state.profile={name:String(draft.name||'You').trim(),salary:Number(draft.salary),salaryDay:Number(draft.salaryDay)};state.activeMonth=key;
  const m=ensureMonth(state,key);m.budgets=Object.fromEntries(Object.entries(draft.budgets).map(([k,v])=>[k,Number(v)]));m.goalPlan.Savings=Number(draft.plannedSavings);
  let goalId='';
  if(draft.goalTarget>0 && String(draft.goalName).trim()){goalId=uid();state.goals.push({id:goalId,name:String(draft.goalName).trim(),target:Number(draft.goalTarget),initialSaved:0,targetDate:draft.goalDate,createdDate:dateISO(now)});}
  if(Number(draft.spentThisMonth)>0)m.expenses.push({id:uid(),amount:Number(draft.spentThisMonth),date:dateISO(now),category:'Other',description:'Spending before setup',payment:'Other',kind:'Need',source:'setup'});
  if(Number(draft.savedThisMonth)>0)m.savings.push({id:uid(),amount:Number(draft.savedThisMonth),date:dateISO(now),goalId,label:goalId?String(draft.goalName).trim():'Savings before setup',source:'setup'});
  if(!validateBackup(state))throw new Error('Check the goal date and your amounts.');
  return state;
}
export const sum = values => values.reduce((a, b) => a + (Number(b) || 0), 0);
export const money = (value, decimals = false) => {const amount=Number.isFinite(Number(value)) ? Number(value) : 0; const paise=decimals || Math.abs(amount - Math.round(amount)) > 1e-7; return new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', minimumFractionDigits: paise ? 2 : 0, maximumFractionDigits: paise ? 2 : 0}).format(amount);};
export const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function dateISO(date = new Date()) {return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;}
export const monthKey = (date = new Date()) => typeof date === 'string' ? date.slice(0, 7) : dateISO(date).slice(0, 7);
export const monthLabel = key => new Date(`${key}-01T12:00:00`).toLocaleDateString('en-IN', {month: 'long', year: 'numeric'});
export function shiftMonth(key, delta) {const date = new Date(`${key}-01T12:00:00`); date.setMonth(date.getMonth() + delta); return monthKey(date);}
export function emptyMonth(salary = 0, template) {return {salary, otherIncome: 0, budgets: {...(template?.budgets || {})}, goalPlan: {...(template?.goalPlan || {})}, expenses: [], savings: [], reviewNotes: '', archived: false};}
export function blankState() {return {version: 1, demo: false, onboarded: false, profile: {name: '', salary: 0, salaryDay: 1}, settings: {theme: 'light', thresholds: {...DEFAULT_THRESHOLDS}}, months: {}, loans: [], goals: [], subscriptions: []};}
export function ensureMonth(state, key) {if (!state.months[key]) {const previous = Object.keys(state.months).filter(k => k < key).sort().at(-1); state.months[key] = emptyMonth(state.profile.salary, state.months[previous]);} return state.months[key];}
export function totals(month) {const salary = Number(month.salary) || 0, otherIncome = Number(month.otherIncome) || 0, spent = sum(month.expenses.map(e => e.amount)), saved = sum(month.savings.map(s => s.amount)); return {salary, otherIncome, income: salary + otherIncome, spent, saved, remaining: salary + otherIncome - spent - saved};}
// A bill estimate reserves money once. Its payment replaces that reservation;
// an amount above the estimate reserves only the extra. Purchases use the rest.
export function recurringBillItems(month) {
 const items=new Map(FIXED.map(key=>[key,{key,name:billName(key),planned:Number(month.budgets[key])||0,paid:0,expenseIds:[]} ]));
 const legacyBills=[];
 for(const e of month.expenses){
  let key=FIXED.includes(e.billKey)?e.billKey:null;
  if(!key&&['Rent / Housing','EMI','Subscriptions'].includes(e.category))key=e.category;
  if(!key&&e.source!=='daily'&&e.category==='Family'&&Number(month.budgets.Family)>0)key='Family';
  if(!key&&e.category==='Bills'){legacyBills.push(e);continue;}
  if(key){const row=items.get(key);row.paid+=e.amount;row.expenseIds.push(e.id);}
 }
 // Older records labelled only "Bills" have no bill identity. Allocate them
 // against the household bill estimates without reserving that money twice.
 for(const e of legacyBills){let left=e.amount;
  for(const key of ['Utilities','Internet','Mobile','Insurance']){const row=items.get(key),paid=Math.min(left,Math.max(0,row.planned-row.paid));if(paid>0){row.paid+=paid;row.expenseIds.push(e.id);left-=paid;}}
  if(left>0){const row=items.get('Utilities');row.paid+=left;row.expenseIds.push(e.id);}
 }
 return [...items.values()].filter(r=>r.planned>0||r.paid>0).map(r=>({...r,reserved:Math.max(r.planned,r.paid),leftToPay:Math.max(0,r.planned-r.paid)}));
}
export function dailySummary(month) {
 const t=totals(month),bills=recurringBillItems(month),billIds=new Set(bills.flatMap(b=>b.expenseIds)),dailyExpenses=month.expenses.filter(e=>!billIds.has(e.id)),dailySpent=sum(dailyExpenses.map(e=>e.amount)),billReserved=sum(bills.map(b=>b.reserved)),plannedSavings=sum(Object.values(month.goalPlan)),savingsReserved=Math.max(plannedSavings,t.saved);
 return {...t,bills,dailyExpenses,dailySpent,billReserved,plannedBills:sum(bills.map(b=>b.planned)),plannedSavings,savingsReserved,available:t.income-billReserved-savingsReserved-dailySpent};
}
export function categoryTotals(expenses) {return CATEGORIES.map(name => ({name, amount: sum(expenses.filter(e => e.category === name).map(e => e.amount))})).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);}
export function categoryBudget(month, category) {const aliases = {'Bills': ['Utilities', 'Internet', 'Mobile', 'Insurance'], 'Other': ['Fixed Other', 'Variable Other'], 'Fuel': ['Fuel']}; return Number(month.budgets[category]) || sum((aliases[category] || []).map(k => month.budgets[k]));}
export function overspending(month) {return categoryTotals(month.expenses).map(c => ({...c, budget: categoryBudget(month, c.name)})).filter(c => c.budget > 0 && c.amount > c.budget).map(c => ({...c, over: c.amount - c.budget})).sort((a, b) => b.over - a.over);}
export function planTotals(month, tightBuffer = 3000) {const income = totals(month).income, spending = sum(Object.values(month.budgets)), savings = sum(Object.values(month.goalPlan)), unallocated = income - spending - savings; return {income, spending, savings, unallocated, status: unallocated < 0 ? 'Over Budget' : unallocated < tightBuffer ? 'Budget Tight' : 'Plan Balanced'};}
export function nextPayday(day, now = new Date()) {const d = Math.min(31, Math.max(1, Number(day) || 1)); const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const candidate = offset => {const first = new Date(start.getFullYear(), start.getMonth() + offset, 1); const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(); return new Date(first.getFullYear(), first.getMonth(), Math.min(d, last));}; let next = candidate(0); if (next < start) next = candidate(1); return {days: Math.round((Date.UTC(next.getFullYear(), next.getMonth(), next.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000), date: dateISO(next)};}
export function repaymentMonths(balance, annualRate, payment) {balance = Number(balance); const rate = Math.max(0, Number(annualRate)) / 1200; payment = Number(payment); if (balance <= 0) return 0; if (payment <= 0 || (rate > 0 && payment <= balance * rate)) return null; if (rate === 0) return Math.ceil(balance / payment); return Math.ceil(-Math.log(1 - balance * rate / payment) / Math.log(1 + rate) - 1e-9);}
export function goalInfo(goal, state, now = new Date()) {const contributions = sum(Object.values(state.months).flatMap(m => m.savings).filter(s => s.goalId === goal.id).map(s => s.amount)); const saved = Number(goal.initialSaved) + contributions, remaining = Math.max(0, goal.target - saved); const due = new Date(`${goal.targetDate}T23:59:59`), created = new Date(`${goal.createdDate || dateISO(now)}T00:00:00`); const months = due < now ? 0 : Math.max(1, (due.getFullYear() - now.getFullYear()) * 12 + due.getMonth() - now.getMonth() + (due.getDate() > now.getDate() ? 1 : 0)); const elapsed = Math.max(0, Math.min(1, (now - created) / Math.max(1, due - created))); const expected = Number(goal.initialSaved) + Math.max(0, goal.target - goal.initialSaved) * elapsed; const status = remaining === 0 ? 'Completed' : due < now ? 'Behind' : saved + goal.target * .03 >= expected ? 'On Track' : saved + goal.target * .15 >= expected ? 'Needs Attention' : 'Behind'; return {saved, remaining, months, monthly: months ? Math.ceil(remaining / months) : remaining, progress: Math.min(100, saved / goal.target * 100), status};}
export function monthlyCost(subscription) {return Number(subscription.cost) * ({monthly: 1, quarterly: 1/3, 'half-yearly': 1/6, yearly: 1/12, weekly: 52/12}[subscription.frequency] || 1);}
export function subscriptionTotals(subscriptions) {const monthly = sum(subscriptions.map(monthlyCost)); const potential = sum(subscriptions.filter(s => s.decision !== 'Keep').map(monthlyCost)); return {monthly, annual: monthly * 12, potential};}
export function affordability(input, thresholds = DEFAULT_THRESHOLDS) {const {price, savings, income, expenses, existingEmi, newEmi, paymentType} = input; const baseSurplus = income - expenses - existingEmi, emi = existingEmi + (paymentType === 'EMI' ? newEmi : 0); const surplus = income - expenses - emi, remaining = savings - (paymentType === 'Cash' ? price : 0); const emiLoad = income > 0 ? emi / income * 100 : emi > 0 ? Infinity : 0; const shortfall = Math.max(0, price + thresholds.minBuffer - savings); const monthsToSave = shortfall === 0 ? 0 : baseSurplus > 0 ? Math.ceil(shortfall / baseSurplus) : null; let status = 'COMFORTABLE'; if (income <= 0 || surplus < 0 || remaining < 0 || emiLoad > thresholds.maxEmiPercent || (paymentType === 'EMI' && price > 0 && newEmi <= 0)) status = 'REVIEW BEFORE BUYING'; else if (remaining < thresholds.minBuffer || surplus < thresholds.minSurplus) status = 'STRETCH'; return {surplus, remaining, emiLoad, monthsToSave, status};}
export function upsertExpense(state, expense) {for (const m of Object.values(state.months)) m.expenses = m.expenses.filter(e => e.id !== expense.id); ensureMonth(state, monthKey(expense.date)).expenses.push({...expense});}
export function deleteExpense(state, id) {for (const m of Object.values(state.months)) m.expenses = m.expenses.filter(e => e.id !== id);}
export function archiveMonth(state, key) {ensureMonth(state, key).archived = true; const next = shiftMonth(key, 1); ensureMonth(state, next); return next;}
export function demoState(now = new Date()) {const state = blankState(), key = monthKey(now); state.demo = true; state.onboarded = true; state.profile = {name: 'Kiran', salary: 75000, salaryDay: 5}; const m = emptyMonth(75000); m.budgets = {'Rent / Housing': 18000, 'EMI': 6500, 'Utilities': 2000, 'Internet': 800, 'Mobile': 500, 'Insurance': 1000, 'Groceries': 5000, 'Food / Delivery': 6000, 'Transport': 2500, 'Shopping': 4000, 'Entertainment': 1000, 'Medical': 500, 'Variable Other': 1200, 'Subscriptions': 1500}; m.goalPlan = {Savings: 8000, 'Emergency Fund': 2000}; const rows = [['Rent / Housing', 'October rent', 18000, 'Bank Transfer', 'Need'], ['EMI', 'Personal loan instalment', 6500, 'Bank Transfer', 'Need'], ['Food / Delivery', 'Weekend dinner & delivery', 2700, 'UPI', 'Want'], ['Food / Delivery', 'Café visits & lunches', 4500, 'UPI', 'Want'], ['Groceries', 'Monthly grocery run', 4600, 'Debit Card', 'Need'], ['Transport', 'Metro & cab rides', 2200, 'UPI', 'Need'], ['Shopping', 'A little wardrobe refresh', 3200, 'Credit Card', 'Want'], ['Subscriptions', 'Gym & streaming services', 1499, 'Credit Card', 'Want'], ['Other', 'Everyday little things', 601, 'Cash', 'Need']]; const today = now.getDate(); m.expenses = rows.map((r, i) => ({id: `demo-exp-${i}`, category: r[0], description: r[1].replace('October', now.toLocaleDateString('en-IN', {month: 'long'})), amount: r[2], payment: r[3], kind: r[4], date: `${key}-${String(Math.max(1, today - (rows.length - i - 1))).padStart(2, '0')}`})); const future = delta => `${shiftMonth(key, delta)}-28`; state.goals = [{id:'demo-emergency', name:'Emergency fund', target:100000, initialSaved:34000, targetDate:future(8), createdDate:`${shiftMonth(key, -2)}-01`}, {id:'demo-laptop', name:'New laptop', target:80000, initialSaved:30000, targetDate:future(5), createdDate:`${key}-01`}, {id:'demo-travel', name:'A well-earned getaway', target:60000, initialSaved:12000, targetDate:future(6), createdDate:`${key}-01`}]; m.savings = [{id:'demo-saving', goalId:'demo-emergency', label:'Emergency fund', amount:10000, date:dateISO(now)}]; state.months[key] = m; state.loans = [{id:'demo-loan', name:'Personal loan', type:'Personal Loan', original:300000, balance:218000, rate:10.99, emi:6500, remainingMonths:40, extra:0}]; state.subscriptions = [{id:'demo-gym', name:'Gym membership', cost:1000, frequency:'monthly', renewalDate:future(0), category:'Fitness', decision:'Keep'}, {id:'demo-netflix', name:'Netflix', cost:199, frequency:'monthly', renewalDate:`${key}-15`, category:'Entertainment', decision:'Keep'}, {id:'demo-spotify', name:'Spotify', cost:119, frequency:'monthly', renewalDate:`${key}-20`, category:'Entertainment', decision:'Review'}, {id:'demo-cloud', name:'Cloud storage', cost:181, frequency:'monthly', renewalDate:`${key}-25`, category:'Software', decision:'Review'}]; return state;}
export function validateBackup(data) {if (!data || data.version !== 1 || typeof data.demo !== 'boolean' || typeof data.onboarded !== 'boolean' || typeof data.profile?.name !== 'string' || !Number.isFinite(data.profile.salary) || data.profile.salary < 0 || !Number.isInteger(data.profile.salaryDay) || data.profile.salaryDay < 1 || data.profile.salaryDay > 31 || !data.months || Array.isArray(data.months) || !data.settings || !['light','dark','system'].includes(data.settings.theme) || !data.settings.thresholds || ![data.loans, data.goals, data.subscriptions].every(Array.isArray)) return false; const validMonth = key => typeof key === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(key); if(data.activeMonth !== undefined && !validMonth(data.activeMonth))return false; const nonnegative = x => typeof x === 'number' && Number.isFinite(x) && x >= 0; const validDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && dateISO(new Date(`${d}T12:00:00`)) === d; if (!Object.keys(DEFAULT_THRESHOLDS).every(k=>nonnegative(data.settings.thresholds[k])) || data.settings.thresholds.maxEmiPercent > 100) return false; for (const [key,m] of Object.entries(data.months)) {if (!validMonth(key) || !m || !nonnegative(m.salary) || !nonnegative(m.otherIncome) || !m.budgets || !m.goalPlan || !Object.values(m.budgets).every(nonnegative) || !Object.values(m.goalPlan).every(nonnegative) || !Array.isArray(m.expenses) || !Array.isArray(m.savings)) return false; if (!m.expenses.every(e => typeof e.id === 'string' && nonnegative(e.amount) && e.amount > 0 && CATEGORIES.includes(e.category) && PAYMENTS.includes(e.payment) && ['Need','Want'].includes(e.kind) && typeof e.description === 'string' && (e.billKey===undefined||(FIXED.includes(e.billKey)&&e.category===billCategory(e.billKey))) && validDate(e.date) && monthKey(e.date) === key)) return false; if (!m.savings.every(s => typeof s.id === 'string' && nonnegative(s.amount) && validDate(s.date) && monthKey(s.date) === key)) return false;}
 return data.loans.every(l => typeof l.id === 'string' && typeof l.name === 'string' && ['original','balance','rate','emi','remainingMonths','extra'].every(k => nonnegative(l[k])) && Number.isInteger(l.remainingMonths)) && data.goals.every(g => typeof g.id === 'string' && typeof g.name === 'string' && nonnegative(g.target) && g.target > 0 && nonnegative(g.initialSaved) && validDate(g.targetDate) && (!g.createdDate || validDate(g.createdDate))) && data.subscriptions.every(s => typeof s.id === 'string' && typeof s.name === 'string' && nonnegative(s.cost) && ['monthly','quarterly','half-yearly','yearly','weekly'].includes(s.frequency) && ['Keep','Review','Cancel'].includes(s.decision) && validDate(s.renewalDate));
}
