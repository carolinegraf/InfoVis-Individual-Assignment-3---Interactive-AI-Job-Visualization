document.addEventListener("DOMContentLoaded", () => init());

function init() {
  const jobSelect = document.getElementById("jobSelect");
  const jobSearch = document.getElementById("jobSearch");
  const jobSuggestions = document.getElementById("jobSuggestions");
  const resetZoomBtn = document.getElementById("resetZoom");
  const tooltip = d3.select("#tooltip");
  const chart = d3.select("#chart");

  let parsedData = [];
  let allJobOptions = [];

  const JOB_FALLBACK = [
    "AI Research Scientist", "AI Software Engineer", "AI Specialist",
    "NLP Engineer", "AI Consultant", "AI Architect",
    "Principal Data Scientist", "Data Analyst", "Autonomous Systems Engineer",
    "AI Product Manager", "Machine Learning Engineer", "Data Engineer",
    "Research Scientist", "ML Ops Engineer", "Robotics Engineer",
    "Head of AI", "Deep Learning Engineer", "Data Scientist",
    "Machine Learning Researcher", "Computer Vision Engineer"
  ];

  // CSV laden
  d3.csv("ai_job_dataset.csv", d3.autoType).then(raw => {
    if (!raw || raw.length === 0) { return; }

    const keys = Object.keys(raw[0]);
    let jobKey = keys.find(k => k.toLowerCase().includes("title")) ||
                 keys.find(k => k.toLowerCase().includes("job") && !k.toLowerCase().includes("id")) ||
                 keys.find(k => k.toLowerCase().includes("job")) ||
                 "job_title";

    parsedData = raw.map(d => ({
      job_title: (d[jobKey] ?? "").toString().trim(),
      years_experience: parseYearsExperience(d["years_experience"]),
      salary_usd: parseNumberSafe(d["salary_usd"])
    })).filter(d => d.job_title && !isNaN(d.years_experience) && !isNaN(d.salary_usd));

    allJobOptions = Array.from(new Set(parsedData.map(d => d.job_title))).sort();
    populateJobDropdown(jobSelect, allJobOptions, chooseDefaultJob(allJobOptions));
    jobSearch.value = jobSelect.value;

    updatePlot();
  }).catch(err => {
    console.error("Fehler beim Laden CSV:", err);
    populateJobDropdown(jobSelect, JOB_FALLBACK, "AI Research Scientist");
    jobSearch.value = jobSelect.value;
  });

  // Autocomplete Vorschläge
  jobSearch.addEventListener("input", () => {
    const q = jobSearch.value.toLowerCase().trim();
    const filtered = q === "" ? allJobOptions : allJobOptions.filter(s => s.toLowerCase().includes(q));
    renderSuggestions(filtered);
  });

  function renderSuggestions(list) {
    jobSuggestions.innerHTML = "";
    if (!list.length) { jobSuggestions.style.display = "none"; return; }
    list.forEach(jt => {
      const li = document.createElement("li");
      li.textContent = jt;
      li.addEventListener("click", () => {
        jobSearch.value = jt;
        populateJobDropdown(jobSelect, allJobOptions, jt);
        jobSuggestions.style.display = "none";
        updatePlot();
      });
      jobSuggestions.appendChild(li);
    });
    jobSuggestions.style.display = "block";
  }

  document.addEventListener("click", e => {
    if (!jobSearch.contains(e.target) && !jobSuggestions.contains(e.target)) {
      jobSuggestions.style.display = "none";
    }
  });

  // Dropdown Event
  jobSelect.addEventListener("change", () => { jobSearch.value = jobSelect.value; updatePlot(); });

  let lastSvg = null;

  function updatePlot() {
    const selJob = jobSelect.value;
    const xVar = "years_experience";
    const yVar = "salary_usd";
    let data = parsedData.filter(d => selJob==="ALL" || d.job_title===selJob);

    if(!data.length) { chart.html('<div class="nodata">Keine Daten für Auswahl.</div>'); return; }

    chart.selectAll("*").remove();
    const width = Math.min(1100, chart.node().clientWidth-24);
    const height = 520;
    const margin = {top:28,right:24,bottom:64,left:88};
    const svg = chart.append("svg").attr("width",width).attr("height",height);
    lastSvg = svg;
    const innerWidth = width-margin.left-margin.right;
    const innerHeight = height-margin.top-margin.bottom;
    const g = svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

    const xExtent = d3.extent(data,d=>d[xVar]); const yExtent = d3.extent(data,d=>d[yVar]);
    const xPad = (xExtent[1]-xExtent[0])*0.08||1; const yPad=(yExtent[1]-yExtent[0])*0.08||(yExtent[1]*0.05);
    const x = d3.scaleLinear().domain([Math.max(0,xExtent[0]-xPad),xExtent[1]+xPad]).range([0,innerWidth]);
    const y = d3.scaleLinear().domain([Math.max(0,yExtent[0]-yPad),yExtent[1]+yPad]).range([innerHeight,0]);
    g.append("g").attr("transform",`translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(Math.min(12,Math.ceil(innerWidth/80))))
     .call(g=>g.append("text").attr("class","axis-label").attr("x",innerWidth/2).attr("y",44).attr("text-anchor","middle").text("Years of experience"));
    g.append("g").call(d3.axisLeft(y).ticks(8).tickFormat(d3.format(",")))
     .call(g=>g.append("text").attr("class","axis-label").attr("transform",`rotate(-90)`).attr("x",-innerHeight/2).attr("y",-62).attr("text-anchor","middle").text("Salary (USD)"));

    g.append("g").attr("stroke","#eee").selectAll("line").data(y.ticks(6)).join("line")
     .attr("x1",0).attr("x2",innerWidth).attr("y1",d=>y(d)).attr("y2",d=>y(d));

    const color = d3.scaleSequential(d3.interpolatePlasma).domain(d3.extent(parsedData,d=>d.salary_usd));
    const points = g.append("g").attr("class","points").selectAll("circle").data(data).join("circle")
      .attr("class","point").attr("cx",d=>x(d[xVar])).attr("cy",d=>y(d[yVar])).attr("r",4.2)
      .attr("fill",d=>color(d.salary_usd))
      .on("mouseover",(event,d)=>{ d3.select(event.currentTarget).raise();
        tooltip.style("display","block").style("left",(event.pageX+10)+"px").style("top",(event.pageY+10)+"px")
        .html(`<strong>${d.job_title}</strong><br>Years: ${d[xVar]}<br>Salary: ${d[yVar]}`);
      })
      .on("mousemove",(event)=>{ tooltip.style("left",(event.pageX+10)+"px").style("top",(event.pageY+10)+"px"); })
      .on("mouseout",()=>{ tooltip.style("display","none"); });

    const zoom = d3.zoom().scaleExtent([1,10]).translateExtent([[-300,-300],[innerWidth+300,innerHeight+300]]).on("zoom",(event)=>{
      const t=event.transform,zx=t.rescaleX(x),zy=t.rescaleY(y);
      g.selectAll(".x-axis-zoom").remove(); g.selectAll(".y-axis-zoom").remove();
      g.append("g").attr("class","x-axis-zoom").attr("transform",`translate(0,${innerHeight})`).call(d3.axisBottom(zx).ticks(Math.min(12,Math.ceil(innerWidth/80))));
      g.append("g").attr("class","y-axis-zoom").call(d3.axisLeft(zy).ticks(8).tickFormat(d3.format(",")));
      points.attr("cx",d=>zx(d[xVar])).attr("cy",d=>zy(d[yVar]));
    });
    svg.call(zoom);

    svg.append("text").attr("x",margin.left+6).attr("y",margin.top+8).attr("font-size",11).attr("fill","#333")
      .text(`Data Points: ${data.length} — Filter: ${selJob==="ALL"?"Alle":selJob}`);

    resetZoomBtn.onclick=()=>{ if(lastSvg) lastSvg.transition().duration(300).call(zoom.transform,d3.zoomIdentity); };
  }

  function populateJobDropdown(selectEl, jobList, defaultValue="ALL") {
    selectEl.innerHTML = "";
    const allOpt=document.createElement("option"); allOpt.value="ALL"; allOpt.text="— Alle Job Titles —"; selectEl.appendChild(allOpt);
    jobList.forEach(jt=>{ const opt=document.createElement("option"); opt.value=jt; opt.text=jt; selectEl.appendChild(opt); });
    selectEl.value = Array.from(selectEl.options).some(o=>o.value===defaultValue)?defaultValue:"ALL";
  }
  function chooseDefaultJob(list){ const f=list.find(s=>s.toLowerCase().includes("ai research scientist")); return f||"ALL"; }
  function parseNumberSafe(x){ if(x==null)return NaN; if(typeof x==="number")return x; const n=parseFloat(String(x).replace(/[\s,$€]/g,"")); return isNaN(n)?NaN:n; }
  function parseYearsExperience(s){ if(s==null)return NaN; if(typeof s==="number")return s; const str=String(s).toLowerCase().trim(); const range=str.match(/(\d+(\.\d+)?)\s*[-–—]\s*(\d+(\.\d+)?)/); if(range){const a=parseFloat(range[1]),b=parseFloat(range[3]); if(!isNaN(a)&&!isNaN(b))return(a+b)/2;} const plus=str.match(/(\d+(\.\d+)?)\s*\+/); if(plus)return parseFloat(plus[1]); const match=str.match(/(\d+(\.\d+)?)/); return match?parseFloat(match[1]):NaN; }
}
