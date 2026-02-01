document.addEventListener("DOMContentLoaded", () => {

// -------------------- Constantes y utilidades --------------------
const DATA_KEY='presupuesto_final';
const CHECK_KEY='checklist_final';
const TRM_KEY='trm_defaults';
const $ = id => document.getElementById(id);

// Valores TRM por defecto
const DEFAULT_TRM = { COP:4200, USD:1.16, EUR:1.0 };

// Guarda/lee TRM por defecto en localStorage
function loadTrmDefaults(){ try{ return JSON.parse(localStorage.getItem(TRM_KEY)) || DEFAULT_TRM; } catch(e){ return DEFAULT_TRM; } }
function saveTrmDefaults(d){ localStorage.setItem(TRM_KEY, JSON.stringify(d)); }
let trmDefaults = loadTrmDefaults();

// Carga datos y checklist
function loadData(){ try{ return JSON.parse(localStorage.getItem(DATA_KEY)) || []; } catch(e){ return []; } }
function saveData(d){ localStorage.setItem(DATA_KEY, JSON.stringify(d)); }
function loadChecklist(){ try{ return JSON.parse(localStorage.getItem(CHECK_KEY)) || {}; } catch(e){ return {}; } }
function saveChecklist(d){ localStorage.setItem(CHECK_KEY, JSON.stringify(d)); }

function formatEuro(v){ return v.toLocaleString('es-ES',{style:'currency',currency:'EUR'}); }

// -------------------- Categorías --------------------
const categorias = {
  fijo:['Alimentación','Vivienda','Transporte','Servicios','Ahorros','Inversiones'],
  variable:['Tarjetas de crédito','Créditos','Salud e higiene','Ocio','Deporte','Otros'],
  ingreso:['Salario','Extra','Inversiones']
};

// utilidad para obtener todas las categorías
function allCategorias(){ return Array.from(new Set(Object.values(categorias).flat())); }

// -------------------- UI: inicializar selects/categorías --------------------
function actualizarCategorias(selId, tipoVal){
  const sel = $(selId);
  sel.innerHTML = '<option value="">-- Selecciona categoría --</option>';
  if(!categorias[tipoVal]) return;
  categorias[tipoVal].forEach(c => {
    const opt = document.createElement('option'); opt.value = c; opt.textContent = c; sel.appendChild(opt);
  });
}

function actualizarFiltroCategoriasPorTipo(tipo){
  const sel = $('filterCategory');
  sel.innerHTML = '<option value="">Todas</option>';
  if(!tipo){ allCategorias().forEach(c => sel.appendChild(new Option(c,c))); return; }
  if(categorias[tipo]) categorias[tipo].forEach(c => sel.appendChild(new Option(c,c)));
}

// Inicializa filtroCategory con todas
actualizarFiltroCategoriasPorTipo();

// -------------------- Filtros y listado --------------------
function getFilteredMovements() {
  let data = loadData();
  const from = $('filterDateFrom').value;
  const to = $('filterDateTo').value;
  const type = $('filterType').value;
  const category = $('filterCategory').value;
  const min = parseFloat($('filterMinAmount').value);
  const max = parseFloat($('filterMaxAmount').value);
  const desc = $('filterDesc').value && $('filterDesc').value.trim().toLowerCase();

  return data.filter(d => {
    // importe normalizado a EUR para comparaciones (si trm 0 -> evitar div/0)
    const monto = (d.currency==='EUR') ? Number(d.amount) : (d.trm? Number(d.amount)/Number(d.trm) : Number(d.amount));
    let ok = true;
    if(from) ok = ok && d.date >= from;
    if(to) ok = ok && d.date <= to;
    if(type) ok = ok && d.type === type;
    if(category) ok = ok && d.category === category;
    if(!isNaN(min)) ok = ok && monto >= min;
    if(!isNaN(max)) ok = ok && monto <= max;
    if(desc) ok = ok && (d.desc||'').toLowerCase().includes(desc);
    return ok;
  }).sort((a,b)=> new Date(b.date) - new Date(a.date));
}

function resetFiltros() {
    $('filterType').value = "";               // 1. Todos los tipos
    $('filterCategory').value = "";           // 2. Todas las categorías

    $('filterDateFrom').value = "";           // 3. Fecha desde vacía
    $('filterDateTo').value = "";             //    Fecha hasta vacía

    $('filterMinAmount').value = "";          // 4. Min sin valor
    $('filterMaxAmount').value = "";          //    Max sin valor

    $('filterDesc').value = "";               // 5. Descripción vacía

    render();  // vuelve a pintar el listado y totales
}



// -------------------- Saldos (header) --------------------
function updateSaldo() {
  const data = loadData();

// SALDO FINAL = ingresos - gastos (todos los movimientos sin filtros)
const saldoFinal = data.reduce((s, m) => {
  const monto = (m.currency === "EUR")
    ? Number(m.amount)
    : Number(m.amount) / Number(m.trm || 1);

  return s + (m.type === "ingreso" ? monto : -monto);
}, 0);


  // Solo movimientos activos
  const activos = data.filter(m => m.enabled !== false);

  // Saldo con filtros
  const saldoTotal = activos.reduce((s, m) => {
    const monto = m.currency === 'EUR' ? Number(m.amount) : Number(m.amount) / Number(m.trm || 1);
    return s + (m.type === 'ingreso' ? monto : -monto);
  }, 0);

  // Saldo Mes (mes actualmente seleccionado en monthPicker)
  const mes = $('monthPicker').value || '';
  const saldoMes = activos
    .filter(m => m.date.startsWith(mes))
    .reduce((s, m) => {
      const monto = m.currency === 'EUR' ? Number(m.amount) : Number(m.amount) / Number(m.trm || 1);
      return s + (m.type === 'ingreso' ? monto : -monto);
    }, 0);

  // Ahorro + Inversión
  const ahorroInv = activos
    .filter(m => ['Ahorros', 'Inversiones'].includes(m.category) && m.type === 'fijo')
    .reduce((s, m) => {
      const monto = m.currency === 'EUR' ? Number(m.amount) : Number(m.amount) / Number(m.trm || 1);
      return s + monto;
    }, 0);

  $('headerSaldos').innerHTML = `
    <div class="saldoBox">Saldo:<br/>
      <span style="color:${saldoTotal>=0?'#50fa7b':'#ff6b6b'}">${formatEuro(saldoTotal)}</span>
    </div>

    <div class="saldoBox">Saldo Final:<br/>
      <span style="color:${saldoFinal>=0?'#50fa7b':'#ff6b6b'}">${formatEuro(saldoFinal)}</span>
    </div>

    <div class="saldoBox">Saldo Mes:<br/>
      <span style="color:${saldoMes>=0?'#50fa7b':'#ff6b6b'}">${formatEuro(saldoMes)}</span>
    </div>

    <div class="saldoBox">Ahorro + Inv:<br/>
      <span style="color:#50fa7b">${formatEuro(ahorroInv)}</span>
    </div>
`;

}

// -------------------- Checklist --------------------
const obligaciones = [
  	{nombre:'Arriendo'},
	{nombre:'Servicios'},
	{nombre:'Transporte'},
	{nombre:'T.C. DAVIVIENDA'},
  	{nombre:'T.C. BANCOLOMBIA'},
	{nombre:'Credito OCCIDENTE'},
	{nombre:'Credito BANCOLOMBIA LAURA'},
	{nombre:'Credito LULO'},
	{nombre:'Credito BANCOLOMBIA HIPOTECARIO'}
];

function renderChecklistTop(){
  const month = $('checkMonthTop').value || new Date().toISOString().slice(0,7);
  let lista = loadChecklist();
  if(!lista[month]) lista[month] = obligaciones.map(o => ({ nombre: o.nombre, check:false }));

  const container = $('checklistContainerTop');
  container.innerHTML = '';

  lista[month].forEach((item,i) => {
    const div = document.createElement('div');
    div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.gap = '6px'; div.style.marginBottom = '6px';

    const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = item.check;
    chk.addEventListener('change', e => { lista[month][i].check = e.target.checked; saveChecklist(lista); });

    const txt = document.createElement('input'); txt.type = 'text'; txt.value = item.nombre; txt.style.flex='1';
    txt.addEventListener('change', e => { lista[month][i].nombre = e.target.value; saveChecklist(lista); });

    const btn = document.createElement('button'); btn.textContent = '🗑️'; btn.title='Eliminar';
    btn.style.background='#ff6b6b'; btn.style.color='white'; btn.style.border='none'; btn.style.padding='4px 8px'; btn.style.borderRadius='6px';
    btn.addEventListener('click', ()=>{ if(confirm('¿Eliminar este item del checklist?')){ lista[month].splice(i,1); saveChecklist(lista); renderChecklistTop(); }});

    div.appendChild(chk); div.appendChild(txt); div.appendChild(btn); container.appendChild(div);
  });

  saveChecklist(lista);
}

// Agregar nuevo item al checklist
$('addCheckItemTop').addEventListener('click', () => {
  const month = $('checkMonthTop').value || new Date().toISOString().slice(0,7);
  const lista = loadChecklist();
  if(!lista[month]) lista[month] = obligaciones.map(o => ({ nombre: o.nombre, check:false }));
  
  // Agregar item nuevo
  lista[month].push({ nombre: 'Nuevo ítem', check: false });
  saveChecklist(lista);
  renderChecklistTop();
});

$('resetChecklistTop').addEventListener('click', () => {
  const month = $('checkMonthTop').value || new Date().toISOString().slice(0,7);
  const lista = loadChecklist();
  // Reiniciar al arreglo inicial de obligaciones
  lista[month] = obligaciones.map(o => ({ nombre: o.nombre, check:false }));
  saveChecklist(lista);
  renderChecklistTop();
});


// -------------------- Movimientos (add/edit/delete) --------------------
let editId = null;

$('add').addEventListener('click', () => {
  const type = $('type').value, category = $('category').value;
  const amount = parseFloat($('amount').value);
  const desc = $('desc').value.trim(), date = $('date').value;
  const currency = $('currency').value;
  const trm = parseFloat($('trm').value) || (trmDefaults[currency] || 1);
  if(!type||!category||!amount||!date) return alert('Completa todos los campos.');
  const data = loadData();
  const id = 'id'+Date.now()+Math.floor(Math.random()*1000);
  data.push({ id, type, category, amount, currency, trm, desc, date });
  saveData(data);
  //limpiar
  $('amount').value=''; $('desc').value='';
  render();
});

function startEdit(id){
  const data = loadData();
  const item = data.find(d=>d.id===id); if(!item) return;
  editId = id;
  $('editType').innerHTML=''; Object.keys(categorias).forEach(k=> $('editType').appendChild(new Option(k,k)));
  $('editType').value = item.type;
  actualizarCategorias('editCategory', item.type);
  $('editCategory').value = item.category;
  $('editAmount').value = item.amount;
  $('editDesc').value = item.desc;
  $('editDate').value = item.date;
  $('editCurrency').value = item.currency;
  $('editTrm').value = item.trm || (trmDefaults[item.currency] || 1);
  $('editModal').style.display = 'flex';
}

$('cancelEdit').addEventListener('click', ()=>{ $('editModal').style.display = 'none'; });

$('saveEdit').addEventListener('click', ()=>{
  const data = loadData();
  const item = data.find(d=>d.id===editId);
  if(!item) return;
  item.type = $('editType').value;
  item.category = $('editCategory').value;
  item.amount = parseFloat($('editAmount').value) || item.amount;
  item.desc = $('editDesc').value;
  item.date = $('editDate').value;
  item.currency = $('editCurrency').value;
  item.trm = parseFloat($('editTrm').value) || item.trm || (trmDefaults[item.currency] || 1);
  // si user marca aplicar TRM por defecto -> actualizar
 
  
  saveData(data);
  $('editModal').style.display = 'none';
  render();
});

function deleteItem(id){
  if(!confirm('¿Borrar este movimiento?')) return;
  const data = loadData();
  const idx = data.findIndex(d=>d.id===id);
  if(idx>-1){ data.splice(idx,1); saveData(data); render(); }
}

function toggleEnabled(id) {
  const data = loadData();
  const item = data.find(d => d.id === id);
  if(!item) return;
  item.enabled = !item.enabled;
  saveData(data);
  render();
}

function duplicateItem(id){
  const data = loadData();
  const item = data.find(d => d.id === id);
  if(!item) return;
  const nuevo = { ...item, id: 'id'+Date.now()+Math.floor(Math.random()*1000) };
  data.push(nuevo);
  saveData(data);
  render();
}

// -------------------- Fechas por defecto y años --------------------
const hoy = new Date().toISOString().slice(0,10);
$('date').value = hoy;
$('monthPicker').value = hoy.slice(0,7);
$('checkMonthTop').value = hoy.slice(0,7);

const yearSel = $('yearSelector');
for(let y=2023;y<=2035;y++){ yearSel.appendChild(new Option(y,y)); }
yearSel.value = new Date().getFullYear();

// -------------------- TRM: sincronizar inputs con defaults --------------------
function applyTrmToInputs(){
  const currency = $('currency').value;
  $('trm').value = trmDefaults[currency] || 1;
}
function applyTrmToEditInputs(){
  const currency = $('editCurrency').value;
  $('editTrm').value = trmDefaults[currency] || 1;
}
$('currency').addEventListener('change', ()=> { applyTrmToInputs(); });
$('editCurrency').addEventListener('change', ()=> { applyTrmToEditInputs(); });


// -------------------- GRAFICAS --------------------
let chartCategorias, chartAnual, chartAhorro;
let cashMode = 'year'; // 'year' or 'month' (por días)

// botones cashflow
$('cashByYear').addEventListener('click', ()=> { cashMode='year'; $('cashByYear').classList.add('toggleOn'); $('cashByYear').classList.remove('toggleOff'); $('cashByMonth').classList.remove('toggleOn'); $('cashByMonth').classList.add('toggleOff'); updateCharts(); });
$('cashByMonth').addEventListener('click', ()=> { cashMode='month'; $('cashByMonth').classList.add('toggleOn'); $('cashByMonth').classList.remove('toggleOff'); $('cashByYear').classList.remove('toggleOn'); $('cashByYear').classList.add('toggleOff'); updateCharts(); });

// Helper: days in month
function daysInMonth(year, month){ return new Date(year, month, 0).getDate(); }

function updateCharts(){
  const data = loadData();
  const view = $('viewSelector').value;
  const mes = $('monthPicker').value || '';
  const año = $('yearSelector').value || new Date().getFullYear().toString();

  const movFiltrados = data.filter(d => {
    if(d.enabled === false) return false;
    if(view === 'mes') return mes && d.date.startsWith(mes);
    return d.date.startsWith(año);
  });

  // ---------------- GASTOS por categoría (ordenado desc) ----------------
  const porCat = {};
  movFiltrados
    .filter(d => d.type !== 'ingreso' && d.enabled !== false)
    .forEach(g => {
      const monto = g.currency === 'EUR' ? Number(g.amount) : Number(g.amount) / Number(g.trm || 1);
      porCat[g.category] = (porCat[g.category] || 0) + monto;
    });

  // ordenar por valor descendente
  const sortedPairs = Object.entries(porCat).sort((a,b)=> b[1]-a[1]);
  const labels = sortedPairs.map(p=>p[0]);
  const values = sortedPairs.map(p=>p[1]);
  const totalGastos = values.reduce((a,b)=> a+b, 0);

  const palette = ['#7F5AF0','#50FA7B','#FF6B6B','#FFA94D','#4DD0E1','#E75480','#C792EA','#8BC34A'];

  if (chartCategorias) chartCategorias.destroy();
  chartCategorias = new Chart($('chartCategorias').getContext('2d'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: palette.slice(0, labels.length), borderColor: '#0b0b0b', borderWidth: 2 }] },
    options: {
      maintainAspectRatio: false,
      plugins: {
        datalabels: {
          color: 'white',
          formatter: (value) => totalGastos ? ((value / totalGastos) * 100).toFixed(1) + '%' : '0%',
          font: { weight: '700', size: 12 }
        },
        legend: { labels: { color: 'white' } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const raw = ctx.raw;
              const pct = totalGastos ? ((raw / totalGastos) * 100).toFixed(1) : '0.0';
              return `${ctx.label}: ${formatEuro(raw)} (${pct}%)`;
            }
          }
        }
      }
    },
    plugins: [ChartDataLabels]
  });

  // ---------------- AHORROS / INVERSIONES acumuladas ----------------
  const meses = ['01','02','03','04','05','06','07','08','09','10','11','12'];
 const saldoPrevio = data
  .filter(d => d.enabled !== false && Number(d.date.slice(0,4)) < Number(año) && ['Ahorros','Inversiones'].includes(d.category) && d.type === 'fijo')
  .reduce((s,d) => {
    const monto = d.currency==='EUR' ? Number(d.amount) : Number(d.amount)/(Number(d.trm)||1);
    return s + monto;
  }, 0);

const ahorrosAn = meses.map(m => {
  return data
    .filter(d => {
      const [dAño,dMes] = d.date.split('-');
      return d.enabled !== false &&
             Number(dAño) === Number(año) &&
             dMes.padStart(2,'0') === m &&
             ['Ahorros','Inversiones'].includes(d.category) &&
             d.type === 'fijo';
    })
    .reduce((s,d) => {
      const monto = d.currency==='EUR' ? Number(d.amount) : Number(d.amount)/(Number(d.trm)||1);
      return s + monto;
    }, 0);
});


  let acum = saldoPrevio;
  const acumData = ahorrosAn.map(v => acum += v);

  if (chartAhorro) chartAhorro.destroy();
  chartAhorro = new Chart($('chartAhorro').getContext('2d'), {
    type: 'bar',
    data: { labels: meses, datasets: [{ label:'Ahorros e Inversiones (€)', data: acumData, backgroundColor:'#50FA7B' }] },
    options: { maintainAspectRatio:false, plugins:{legend:{labels:{color:'white'}}}, scales:{ y:{ ticks:{ callback: v => formatEuro(v), color:'white' } , grid:{color:'#111'} }, x:{ ticks:{ color:'white' }, grid:{color:'#111'} } } }
  });

  // ---------------- CASHFLOW ----------------
  if(cashMode === 'year'){
    // Por año: ingresos/gastos por mes (igual que antes)
    const ingresosAn = meses.map(m => data
      .filter(d => d.enabled !== false && d.date.startsWith(`${año}-${m}`) && d.type === 'ingreso')
      .reduce((s,d) => s + (d.currency==='EUR' ? Number(d.amount) : Number(d.amount)/Number(d.trm||1)), 0)
    );
    const gastosAn = meses.map(m => data
      .filter(d => d.enabled !== false && d.date.startsWith(`${año}-${m}`) && d.type !== 'ingreso')
      .reduce((s,d) => s + (d.currency==='EUR' ? Number(d.amount) : Number(d.amount)/Number(d.trm||1)), 0)
    );
    if(chartAnual) chartAnual.destroy();
    chartAnual = new Chart($('chartAnual').getContext('2d'), {
      type: 'line',
      data: {
        labels: meses,
        datasets: [
          { label:'Ingresos', data: ingresosAn, borderColor:'#50FA7B', backgroundColor:'transparent', tension:0.25, pointRadius:3 },
          { label:'Gastos', data: gastosAn, borderColor:'#FF6B6B', backgroundColor:'transparent', tension:0.25, pointRadius:3 }
        ]
      },
      options: { maintainAspectRatio:false, plugins:{legend:{labels:{color:'white'}}}, scales:{ y:{ ticks:{ callback:v=>formatEuro(v), color:'white' }, grid:{color:'#111'} }, x:{ ticks:{ color:'white' }, grid:{color:'#111'} } } }
    });

    // actualizar tabla resumen con esos datos
    updateResumenTable(ingresosAn, gastosAn);

  } else {
    // cashMode === 'month' -> desglosar por días del mes seleccionado
    if(!mes) {
      // si no hay mes seleccionado: mostrar mensaje pequeño y limpiar chart
      if(chartAnual) chartAnual.destroy();
      // llenar resumen con ceros
      updateResumenTable(new Array(12).fill(0), new Array(12).fill(0));
    } else {
      const [aSeleccionado, mSeleccionado] = mes.split('-'); const days = daysInMonth(Number(aSeleccionado), Number(mSeleccionado));
      const labelsDias = Array.from({length: days}, (_,i)=> String(i+1).padStart(2,'0'));
      const ingresosDias = labelsDias.map(d => {
        const dayStr = `${aSeleccionado}-${mSeleccionado.padStart(2,'0')}-${d}`;
        return data.filter(it => it.enabled !== false && it.type === 'ingreso' && it.date === dayStr)
                   .reduce((s,d)=> s + (d.currency==='EUR' ? Number(d.amount) : Number(d.amount)/Number(d.trm||1)), 0);
      });
      const gastosDias = labelsDias.map(d => {
        const dayStr = `${aSeleccionado}-${mSeleccionado.padStart(2,'0')}-${d}`;
        return data.filter(it => it.enabled !== false && it.type !== 'ingreso' && it.date === dayStr)
                   .reduce((s,d)=> s + (d.currency==='EUR' ? Number(d.amount) : Number(d.amount)/Number(d.trm||1)), 0);
      });
      if(chartAnual) chartAnual.destroy();
      chartAnual = new Chart($('chartAnual').getContext('2d'), {
        type: 'line',
        data: {
          labels: labelsDias,
          datasets: [
            { label:'Ingresos', data: ingresosDias, borderColor:'#50FA7B', backgroundColor:'transparent', tension:0.25, pointRadius:3 },
            { label:'Gastos', data: gastosDias, borderColor:'#FF6B6B', backgroundColor:'transparent', tension:0.25, pointRadius:3 }
          ]
        },
        options: { maintainAspectRatio:false, plugins:{legend:{labels:{color:'white'}}}, scales:{ y:{ ticks:{ callback:v=>formatEuro(v), color:'white' }, grid:{color:'#111'} }, x:{ ticks:{ color:'white' }, grid:{color:'#111'} } } }
      });

      // construir datos para resumen (solo mes seleccionado -> lo ubicamos en su mes correspondiente)
      const ingresosAn = new Array(12).fill(0);
      const gastosAn = new Array(12).fill(0);
      ingresosAn[Number(mSeleccionado)-1] = ingresosDias.reduce((a,b)=>a+b,0);
      gastosAn[Number(mSeleccionado)-1] = gastosDias.reduce((a,b)=>a+b,0);
      updateResumenTable(ingresosAn, gastosAn);
    }
  }

  // actualizar totales del filtro (sección histórico)
  updateFilterTotals();
}

/// -------------------- Resumen tabla (con arrastre de saldo previo) --------------------
function updateResumenTable(ingresosAn, gastosAn){
  const tbody = $('tablaResumen').querySelector('tbody'); 
  tbody.innerHTML = '';

  let totalIn=0, totalG=0, totalSaldoMes=0;
  const meses = ['01','02','03','04','05','06','07','08','09','10','11','12'];

  const año = Number($('yearSelector').value);
  const data = loadData();

  // 1️⃣ Calcular saldo del año anterior
  const saldoPrevio = data
    .filter(d => {
      if(d.enabled === false) return false;
      const añoMov = Number(d.date.slice(0,4));
      return añoMov < año;
    })
    .reduce((total, d) => {
      const monto = d.currency === 'EUR'
        ? Number(d.amount)
        : Number(d.amount) / Number(d.trm || 1);
      return total + (d.type === 'ingreso' ? monto : -monto);
    }, 0);

  let saldoAcum = saldoPrevio;

  // 2️⃣ Construir filas mes a mes
  meses.forEach((m, idx) => {
    const ing = ingresosAn[idx] || 0;
    const gas = gastosAn[idx] || 0;
    const saldoMes = ing - gas;
    saldoAcum += saldoMes;

    totalIn += ing;
    totalG += gas;
    totalSaldoMes += saldoMes;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m}</td>
      <td>${formatEuro(ing)}</td>
      <td>${formatEuro(gas)}</td>
      <td style="color:${saldoMes<0?'#ff6b6b':'#50fa7b'}">${formatEuro(saldoMes)}</td>
      <td style="color:${saldoAcum<0?'#ff6b6b':'#50fa7b'}">${formatEuro(saldoAcum)}</td>
    `;
    tbody.appendChild(tr);
  });

  // 3️⃣ Pie de tabla (tfoot)
  const tfoot = $('tablaResumen').querySelector('tfoot tr');
  tfoot.innerHTML = `
    <th>Total</th>
    <th>${formatEuro(totalIn)}</th>
    <th>${formatEuro(totalG)}</th>
    <th>${formatEuro(totalSaldoMes)}</th>
    <th>${formatEuro(saldoAcum)}</th>
  `;
}



// -------------------- Render lista + suma según filtro --------------------
function updateFilterTotals(){
  const data = getFilteredMovements();
  let totalIngresos = 0, totalGastos = 0;
  data.forEach(it => {
    if(it.enabled === false) return;  // ✅ ignorar los desmarcados

    const monto = it.currency==='EUR' ? Number(it.amount) : Number(it.amount)/Number(it.trm||1);
    if(it.type === 'ingreso') totalIngresos += monto;
    else totalGastos += monto;
  });
  const neto = totalIngresos - totalGastos;
  $('filtroTotalIngresos').textContent = `Ingresos: ${formatEuro(totalIngresos)}`;
  $('filtroTotalGastos').textContent = `Gastos: ${formatEuro(totalGastos)}`;
  $('filtroTotalNeto').textContent = `Neto: ${formatEuro(neto)}`;
}

function render() {
  // 1️⃣ Movimientos filtrados para la tabla
  const dataFiltrada = getFilteredMovements();
  const tbody = $('list');
  tbody.innerHTML = '';

  // 1️⃣ Calcular saldo acumulado: usamos array invertido para calcular correctamente
 let saldoAcum = 0;
const saldos = [];

// recorrer desde el movimiento más antiguo al más reciente
dataFiltrada.slice().reverse().forEach(item => {

  // ⛔ ignorar movimientos deshabilitados
  if(item.enabled === false){
    saldos.push(saldoAcum);
    return;
  }

  const monto = item.currency === 'EUR'
      ? Number(item.amount)
      : Number(item.amount) / Number(item.trm || 1);

  const valor = (item.type === 'ingreso') ? monto : -monto;
  saldoAcum += valor;
  saldos.push(saldoAcum);
});

// volver al orden visual (más reciente arriba)
saldos.reverse();


  // 2️⃣ Crear filas con saldo
  dataFiltrada.forEach((item, index) => {
    const cls = item.type === 'ingreso' ? 'income' : 'expense';
    const montoEuro = item.currency==='EUR' ? Number(item.amount) : Number(item.amount)/Number(item.trm||1);
    const tr = document.createElement('tr');
    if(item.enabled === false) tr.style.opacity = '0.5';

    tr.innerHTML = `
      <td>${item.date}</td>
      <td class="${cls}">${item.type}</td>
      <td>${item.category}</td>
      <td>${formatEuro(montoEuro)}</td>
      <td style="color:${saldos[index]<0?'#ff6b6b':'#50fa7b'}">${formatEuro(saldos[index])}</td>
      <td title="${item.desc||''}">${item.desc||''}</td>
      <td style="white-space:nowrap;">
        <button onclick="startEdit('${item.id}')" style="margin-right:6px;">✏️</button>
        <button onclick="deleteItem('${item.id}')" style="margin-right:6px;">🗑️</button>
        <button onclick="duplicateItem('${item.id}')" style="margin-right:6px;">📄</button>
        <input type="checkbox" ${item.enabled!==false?'checked':''} title="Habilitar/Deshabilitar" onclick="toggleEnabled('${item.id}')">
      </td>
    `;
    tbody.appendChild(tr);
  });



  // 2️⃣ Checklist (siempre se renderiza)
  renderChecklistTop();

  // 3️⃣ Gráficos y saldo (siempre con todos los movimientos)
  updateCharts();   // gráficos
  updateSaldo();    // saldo header

  // 4️⃣ Ajuste de altura del histórico
  ajustarAlturaHistorico();

  // 5️⃣ Totales del filtro (solo afecta la sección de filtro)
  updateFilterTotals();
}


// -------------------- Ajuste altura histórico --------------------
function ajustarAlturaHistorico(){
  const gridInferior = document.querySelector('.grid-inferior');
  const movHeader = $('movimientosHeader');
  const movBody = $('movimientosBody');
  const alturaTotal = gridInferior.offsetHeight;
  const alturaHeader = movHeader.offsetHeight;
  const alturaBody = alturaTotal - alturaHeader - 8;
  movBody.style.height = alturaBody + 'px';
}




// -------------------- Listeners y arranque --------------------
$('monthPicker').addEventListener('change', render);
$('yearSelector').addEventListener('change', render);
$('viewSelector').addEventListener('change', render);
$('type').addEventListener('change', ()=> actualizarCategorias('category', $('type').value));
$('checkMonthTop').addEventListener('change', renderChecklistTop);
window.addEventListener('load', ajustarAlturaHistorico);
window.addEventListener('resize', ajustarAlturaHistorico);

['filterType','filterCategory','filterDateFrom','filterDateTo','filterMinAmount','filterMaxAmount','filterDesc'].forEach(id => {
  $(id).addEventListener('input', ()=> {
    if(id === 'filterType'){
      const val = $('filterType').value;
      actualizarFiltroCategoriasPorTipo(val);
    }
    render();
  });
});

// Inicialización categorias y trm
actualizarCategorias('category','ingreso');
actualizarCategorias('editCategory','ingreso');
$('editType').addEventListener('change', ()=> actualizarCategorias('editCategory', $('editType').value));

// Inicializar trm defaults en inputs
function initTrmUI(){
  // asegurar que trmDefaults tenga claves
  trmDefaults = Object.assign({}, DEFAULT_TRM, trmDefaults);
  saveTrmDefaults(trmDefaults);
  // aplicar al input
  applyTrmToInputs();
  applyTrmToEditInputs();
}
initTrmUI();

// cuando editCurrency cambia, actualizar editTrm placeholder
$('editCurrency').addEventListener('change', ()=> { $('editTrm').value = trmDefaults[$('editCurrency').value] || 1; });

// manejar aplicar TRM desde el input principal (si usuario lo cambia)
$('trm').addEventListener('change', ()=> {
  const cur = $('currency').value;
  const v = parseFloat($('trm').value);
  if(cur && !isNaN(v)) {
    trmDefaults[cur] = v;
    saveTrmDefaults(trmDefaults);
  }
});

// --- Seleccionar / Deseleccionar según filtros ---
$('toggleSelect').addEventListener('click', () => {
    const rows = document.querySelectorAll('#list tr'); // Todas las filas visibles
    if (rows.length === 0) return;

    // Obtener todos los checkboxes visibles
    const checkboxes = Array.from(rows)
        .map(r => r.querySelector('input[type="checkbox"]'))
        .filter(c => c !== null);

    if (checkboxes.length === 0) return;

    // Verificar si hay al menos un checkbox sin seleccionar
    const algunoNoMarcado = checkboxes.some(c => !c.checked);

    // Si hay uno sin seleccionar → seleccionar todos los visibles
    // Si todos están seleccionados → desmarcar todos los visibles
    checkboxes.forEach(c => {
        const id = c.getAttribute('onclick').match(/toggleEnabled\('(.+?)'\)/)[1];
        const data = loadData();
        const item = data.find(d => d.id === id);
        if(item) {
            item.enabled = algunoNoMarcado; // actualizar estado
            saveData(data);
        }
    });

    render(); // volver a pintar tod

});


// -------------------- Inicio render --------------------
render();

});
