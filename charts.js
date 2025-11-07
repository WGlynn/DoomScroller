// Simple inline charting library - no external dependencies
// Replacement for Chart.js to avoid CSP issues

class SimpleChart {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = options;
        this.destroyed = false;
    }

    destroy() {
        this.destroyed = true;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    _setCanvasSize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
    }
}

class BarChart extends SimpleChart {
    constructor(canvas, config) {
        super(canvas, config.options);
        this.data = config.data;
        this.config = config;
        this.render();
    }

    render() {
        this._setCanvasSize();
        const { labels, datasets } = this.data;
        const data = datasets[0].data;
        const backgroundColor = datasets[0].backgroundColor || '#6366f1';

        // Calculate dimensions
        const padding = { top: 20, right: 20, bottom: 40, left: 50 };
        const chartWidth = this.width - padding.left - padding.right;
        const chartHeight = this.height - padding.top - padding.bottom;

        // Find max value
        const maxValue = Math.max(...data, 1);
        const barWidth = chartWidth / data.length;
        const barSpacing = barWidth * 0.2;
        const actualBarWidth = barWidth - barSpacing;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw grid lines (horizontal)
        this.ctx.strokeStyle = '#334155';
        this.ctx.lineWidth = 1;
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartHeight / gridLines) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(padding.left, y);
            this.ctx.lineTo(this.width - padding.right, y);
            this.ctx.stroke();
        }

        // Draw bars
        this.ctx.fillStyle = backgroundColor;
        data.forEach((value, i) => {
            const barHeight = (value / maxValue) * chartHeight;
            const x = padding.left + (i * barWidth) + (barSpacing / 2);
            const y = this.height - padding.bottom - barHeight;

            // Rounded rectangle
            const radius = 4;
            this.ctx.beginPath();
            this.ctx.moveTo(x + radius, y);
            this.ctx.lineTo(x + actualBarWidth - radius, y);
            this.ctx.quadraticCurveTo(x + actualBarWidth, y, x + actualBarWidth, y + radius);
            this.ctx.lineTo(x + actualBarWidth, y + barHeight);
            this.ctx.lineTo(x, y + barHeight);
            this.ctx.lineTo(x, y + radius);
            this.ctx.quadraticCurveTo(x, y, x + radius, y);
            this.ctx.closePath();
            this.ctx.fill();
        });

        // Draw labels (X axis)
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = '12px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        labels.forEach((label, i) => {
            const x = padding.left + (i * barWidth) + (barWidth / 2);
            const y = this.height - padding.bottom + 20;
            this.ctx.fillText(label, x, y);
        });

        // Draw Y axis labels
        this.ctx.textAlign = 'right';
        for (let i = 0; i <= gridLines; i++) {
            const value = (maxValue / gridLines) * (gridLines - i);
            const y = padding.top + (chartHeight / gridLines) * i + 5;
            this.ctx.fillText(value.toFixed(1), padding.left - 10, y);
        }
    }
}

class DoughnutChart extends SimpleChart {
    constructor(canvas, config) {
        super(canvas, config.options);
        this.data = config.data;
        this.config = config;
        this.render();
    }

    render() {
        this._setCanvasSize();
        const { labels, datasets } = this.data;
        const data = datasets[0].data;
        const colors = datasets[0].backgroundColor || ['#6366f1', '#10b981', '#f59e0b', '#ec4899'];

        // Calculate center and radius
        const centerX = this.width / 2;
        const centerY = (this.height - 60) / 2; // Leave room for legend
        const radius = Math.min(centerX, centerY) - 20;
        const innerRadius = radius * 0.6; // Doughnut hole

        // Calculate total
        const total = data.reduce((a, b) => a + b, 0);

        // Draw doughnut segments
        let startAngle = -Math.PI / 2; // Start at top
        data.forEach((value, i) => {
            const sliceAngle = (value / total) * Math.PI * 2;

            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
            this.ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
            this.ctx.closePath();
            this.ctx.fillStyle = colors[i];
            this.ctx.fill();

            startAngle += sliceAngle;
        });

        // Draw legend at bottom
        const legendY = this.height - 40;
        const legendItemWidth = this.width / labels.length;

        this.ctx.font = '12px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'center';

        labels.forEach((label, i) => {
            const x = (i * legendItemWidth) + (legendItemWidth / 2);

            // Color box
            this.ctx.fillStyle = colors[i];
            this.ctx.fillRect(x - 30, legendY - 6, 12, 12);

            // Label text
            this.ctx.fillStyle = '#94a3b8';
            this.ctx.fillText(label, x + 10, legendY + 5);
        });
    }
}

class LineChart extends SimpleChart {
    constructor(canvas, config) {
        super(canvas, config.options);
        this.data = config.data;
        this.config = config;
        this.render();
    }

    render() {
        this._setCanvasSize();
        const { labels, datasets } = this.data;
        const dataset = datasets[0];
        const data = dataset.data;
        const borderColor = dataset.borderColor || '#10b981';
        const backgroundColor = dataset.backgroundColor || 'rgba(16, 185, 129, 0.1)';
        const fill = dataset.fill !== false;

        // Calculate dimensions
        const padding = { top: 20, right: 20, bottom: 40, left: 50 };
        const chartWidth = this.width - padding.left - padding.right;
        const chartHeight = this.height - padding.top - padding.bottom;

        // Find max value (filter out nulls)
        const validData = data.filter(v => v !== null);
        const maxValue = Math.max(...validData, 100);
        const minValue = 0;
        const range = maxValue - minValue;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw grid lines (horizontal)
        this.ctx.strokeStyle = '#334155';
        this.ctx.lineWidth = 1;
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartHeight / gridLines) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(padding.left, y);
            this.ctx.lineTo(this.width - padding.right, y);
            this.ctx.stroke();
        }

        // Calculate points
        const pointSpacing = chartWidth / (data.length - 1);
        const points = data.map((value, i) => {
            if (value === null) return null;
            const x = padding.left + (i * pointSpacing);
            const y = padding.top + chartHeight - ((value - minValue) / range * chartHeight);
            return { x, y, value };
        }).filter(p => p !== null);

        // Draw filled area
        if (fill && points.length > 0) {
            this.ctx.beginPath();
            this.ctx.moveTo(points[0].x, this.height - padding.bottom);
            points.forEach(point => {
                this.ctx.lineTo(point.x, point.y);
            });
            this.ctx.lineTo(points[points.length - 1].x, this.height - padding.bottom);
            this.ctx.closePath();
            this.ctx.fillStyle = backgroundColor;
            this.ctx.fill();
        }

        // Draw line with tension (curved)
        if (points.length > 0) {
            this.ctx.beginPath();
            this.ctx.moveTo(points[0].x, points[0].y);

            for (let i = 0; i < points.length - 1; i++) {
                const current = points[i];
                const next = points[i + 1];
                const tension = 0.4;

                const cp1x = current.x + (next.x - current.x) * tension;
                const cp1y = current.y;
                const cp2x = next.x - (next.x - current.x) * tension;
                const cp2y = next.y;

                this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, next.x, next.y);
            }

            this.ctx.strokeStyle = borderColor;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        // Draw points
        points.forEach(point => {
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            this.ctx.fillStyle = borderColor;
            this.ctx.fill();
        });

        // Draw labels (X axis)
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = '12px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        labels.forEach((label, i) => {
            const x = padding.left + (i * pointSpacing);
            const y = this.height - padding.bottom + 20;
            this.ctx.fillText(label, x, y);
        });

        // Draw Y axis labels
        this.ctx.textAlign = 'right';
        for (let i = 0; i <= gridLines; i++) {
            const value = maxValue - ((maxValue - minValue) / gridLines) * i;
            const y = padding.top + (chartHeight / gridLines) * i + 5;
            this.ctx.fillText(Math.round(value), padding.left - 10, y);
        }
    }
}

// Export compatible with Chart.js API
window.Chart = class Chart {
    constructor(canvas, config) {
        if (config.type === 'bar') {
            return new BarChart(canvas, config);
        } else if (config.type === 'doughnut') {
            return new DoughnutChart(canvas, config);
        } else if (config.type === 'line') {
            return new LineChart(canvas, config);
        }
    }
};
