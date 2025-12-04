// Note: This code is partly inspired by the “Global Temperature Trends” example on ObservableHQ. https://observablehq.com/@d3/global-temperature-trends
// The overall D3 structure (CSV loading, scales, axes, plotting circles) and color scaling was adapted from that example.
// ChatGPT has been used to help write this code, especially for:
// - Adding interactivity
// - Handling data parsing and fallback logic


document.addEventListener("DOMContentLoaded", () => {
  const jobSelect = document.getElementById("jobSelect");
  const chart = d3.select("#chart");
  const tooltip = d3.select("#tooltip");
  const resetBtn = document.getElementById("resetZoom");

  let dataAll = [];
  let jobs = [];
  let svg, zoomBehavior;

  const fallbackJobs = ["AI Research Scientist", "AI Software Engineer", "Data Scientist"];

  // Daten laden
  d3.csv("ai_job_dataset.csv", d3.autoType).then(raw => {
    if (!raw || !raw.length) return;
    const jobKey = Object.keys(raw[0]).find(k => k.toLowerCase().includes("title")) || "job_title";

    dataAll = raw.map(d => ({
      job: d[jobKey],
      years: parseFloat(d["years_experience"]) || 0,
      salary: parseFloat(d["salary_usd"]) || 0
    })).filter(d => d.job);

    jobs = Array.from(new Set(dataAll.map(d => d.job))).sort();
    fillDropdown(jobSelect, jobs, "AI Research Scientist");
    drawPlot();
  }).catch(() => {
    fillDropdown(jobSelect, fallbackJobs, "AI Research Scientist");
    drawPlot();
  });

  jobSelect.addEventListener("change", drawPlot);

  function fillDropdown(sel, list, defaultVal) {
    sel.innerHTML = "";
    const allOpt = document.createElement("option");
    allOpt.value = "ALL";
    allOpt.text = "All";
    sel.appendChild(allOpt);

    list.forEach(jt => {
      const opt = document.createElement("option");
      opt.value = jt;
      opt.text = jt;
      sel.appendChild(opt);
    });

    sel.value = list.includes(defaultVal) ? defaultVal : "ALL";
  }

  function drawPlot() {
    const selJob = jobSelect.value;
    const data = dataAll.filter(d => selJob === "ALL" || d.job === selJob);
    if (!data.length) { chart.html("No data"); return; }

    chart.selectAll("*").remove();
    const width = chart.node().clientWidth;
    const height = chart.node().clientHeight;

    const margin = { top: 20, right: 20, bottom: 50, left: 70 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    svg = chart.append("svg")
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Skalen
    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.years))
      .range([0, innerW])
      .nice();

    const y = d3.scaleLinear()
      .domain(d3.extent(data, d => d.salary))
      .range([innerH, 0])
      .nice();

    const maxSalary = d3.max(data, d => d.salary);
    const minSalary = d3.min(data, d => d.salary);

    const color = d3.scaleLinear()
      .domain([minSalary, maxSalary])
      .range(["lightblue", "darkblue"]);

    // Achsen
    const xAxisG = g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x));

    const yAxisG = g.append("g")
      .call(d3.axisLeft(y));

    // X-Achsenbeschriftung
    svg.append("text")
      .attr("x", margin.left + innerW / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .style("font-weight", "bold")
      .text("Years of Experience");

    // Y-Achsenbeschriftung
    svg.append("text")
      .attr("transform", `rotate(-90)`)
      .attr("x", -margin.top - innerH / 2)
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .style("font-weight", "bold")
      .text("Salary (USD)");

    // Punkte
    const points = g.selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", d => x(d.years))
      .attr("cy", d => y(d.salary))
      .attr("r", 5)
      .attr("fill", d => color(d.salary))
      .on("mouseover", (event, d) => {
        tooltip.style("display", "block")
          .style("left", event.pageX + 5 + "px")
          .style("top", event.pageY + 5 + "px")
          .text(`${d.job}, Years: ${d.years}, $${d.salary}`);
      })
      .on("mousemove", event => {
        tooltip.style("left", event.pageX + 5 + "px")
          .style("top", event.pageY + 5 + "px");
      })
      .on("mouseout", () => tooltip.style("display", "none"));

    // Zoom
    zoomBehavior = d3.zoom()
      .scaleExtent([1, 5])
      .translateExtent([[-100, -100], [innerW + 100, innerH + 100]])
      .on("zoom", event => {
        const zx = event.transform.rescaleX(x);
        const zy = event.transform.rescaleY(y);
        points.attr("cx", d => zx(d.years))
          .attr("cy", d => zy(d.salary));
        xAxisG.call(d3.axisBottom(zx));
        yAxisG.call(d3.axisLeft(zy));
      });

    svg.call(zoomBehavior);
  }

  // Reset Zoom
  resetBtn.addEventListener("click", () => {
    if (svg && zoomBehavior) {
      svg.transition().duration(300).call(zoomBehavior.transform, d3.zoomIdentity);
    }
  });
});
