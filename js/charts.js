/* charts.js — encapsula toda a integração com Chart.js */
window.App = window.App || {};

App.Charts = (function () {
  const U = App.Utils;
  const instances = {};

  const PALETTE = [
    '#F5A623', '#2DD4A7', '#FF6B6B', '#6EA8FE', '#C084FC', '#FBBF24',
    '#34D3B5', '#F472B6', '#60A5FA', '#A3E635', '#FB923C'
  ];

  // Se o Chart.js não carregar (ex: sem internet), o app inteiro não pode
  // travar por causa disso — cada função de gráfico verifica antes de usar.
  function isAvailable() {
    return typeof Chart !== 'undefined';
  }

  function drawUnavailableState(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#8A93A3';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Gráfico indisponível (sem conexão)', canvas.width / 2, canvas.height / 2);
  }

  function destroy(key) {
    if (instances[key]) {
      instances[key].destroy();
      delete instances[key];
    }
  }

  function baseFont() {
    return { family: 'Inter, sans-serif', size: 11 };
  }

  function renderCategoryChart(canvasId, breakdown) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (!isAvailable()) return drawUnavailableState(canvas);
    destroy(canvasId);

    if (!breakdown.length) {
      drawEmptyState(canvas);
      return;
    }

    const ctx = canvas.getContext('2d');
    instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: breakdown.map(b => `${b.category.icon} ${b.category.label}`),
        datasets: [{
          data: breakdown.map(b => b.total),
          backgroundColor: breakdown.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#C4CBD4', font: baseFont(), boxWidth: 10, padding: 12 }
          },
          tooltip: {
            callbacks: {
              label: (item) => ` ${U.formatCurrency(item.raw)}`
            }
          }
        }
      }
    });
  }

  function renderIncomeExpenseChart(canvasId, income, expense) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (!isAvailable()) return drawUnavailableState(canvas);
    destroy(canvasId);

    const ctx = canvas.getContext('2d');
    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Receitas', 'Despesas'],
        datasets: [{
          data: [income, expense],
          backgroundColor: ['#2DD4A7', '#FF6B6B'],
          borderRadius: 8,
          maxBarThickness: 56
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (item) => ` ${U.formatCurrency(item.raw)}` } }
        },
        scales: {
          x: { ticks: { color: '#C4CBD4', font: baseFont() }, grid: { display: false } },
          y: {
            ticks: { color: '#8A93A3', font: baseFont(), callback: (v) => U.formatCurrency(v) },
            grid: { color: 'rgba(255,255,255,0.06)' }
          }
        }
      }
    });
  }

  function renderDailyEvolutionChart(canvasId, evolution) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (!isAvailable()) return drawUnavailableState(canvas);
    destroy(canvasId);

    const labels = (evolution && evolution.labels) || [];
    const values = (evolution && evolution.values) || [];

    if (!labels.length) {
      drawEmptyState(canvas);
      return;
    }

    let cumulative = 0;
    const cumulativeData = values.map(v => (cumulative = U.roundMoney(cumulative + v)));

    const ctx = canvas.getContext('2d');
    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: cumulativeData,
          borderColor: '#F5A623',
          backgroundColor: 'rgba(245,166,35,0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => items[0].label,
              label: (item) => ` ${U.formatCurrency(item.raw)}`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#8A93A3', font: baseFont(), maxTicksLimit: 8 },
            grid: { display: false }
          },
          y: {
            ticks: { color: '#8A93A3', font: baseFont(), callback: (v) => U.formatCurrency(v) },
            grid: { color: 'rgba(255,255,255,0.06)' }
          }
        }
      }
    });
  }

  function drawEmptyState(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#8A93A3';
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sem dados neste mês', canvas.width / 2, canvas.height / 2);
  }

  return {
    renderCategoryChart,
    renderIncomeExpenseChart,
    renderDailyEvolutionChart
  };
})();
