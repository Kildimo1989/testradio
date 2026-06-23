const fallbackStations=[
{name:'RTÉ Radio 1',logo:'https://upload.wikimedia.org/wikipedia/en/thumb/0/08/RTE_Radio_1.svg/120px-RTE_Radio_1.svg.png',stream:''},
{name:'Today FM',logo:'https://upload.wikimedia.org/wikipedia/en/thumb/8/88/Today_FM_logo.svg/120px-Today_FM_logo.svg.png',stream:''},
{name:'Midwest Radio',logo:'',stream:''}
];
const container=document.getElementById('stations');
function render(list){container.innerHTML='';list.forEach(s=>{const d=document.createElement('div');d.className='station';d.innerHTML=`<img src="${s.logo||''}"><div><h3>${s.name}</h3></div>`;container.appendChild(d);});}
render(fallbackStations);
