/**
 * UI Components Library for Lab Notes
 */

class AnimatedList {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = {
            items: [],
            onItemSelect: (item, index) => { },
            showGradients: true,
            enableArrowNavigation: true,
            displayScrollbar: true,
            ...options
        };
        this.selectedIndex = -1;
        this.render();
    }

    render() {
        this.container.classList.add('scroll-list-container');

        const scrollList = document.createElement('div');
        scrollList.className = `scroll-list ${this.options.displayScrollbar ? '' : 'no-scrollbar'}`;

        this.options.items.forEach((item, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'item';
            itemEl.innerHTML = `<div class="item-text">${item}</div>`;
            itemEl.onclick = () => this.selectItem(index);
            scrollList.appendChild(itemEl);
        });

        this.container.appendChild(scrollList);
        this.scrollList = scrollList;

        if (this.options.showGradients) {
            const topGrad = document.createElement('div');
            topGrad.className = 'top-gradient';
            const bottomGrad = document.createElement('div');
            bottomGrad.className = 'bottom-gradient';
            this.container.appendChild(topGrad);
            this.container.appendChild(bottomGrad);
        }

        if (this.options.enableArrowNavigation) {
            window.addEventListener('keydown', this.handleKeyDown.bind(this));
        }
    }

    selectItem(index) {
        const items = this.scrollList.querySelectorAll('.item');
        items.forEach(el => el.classList.remove('selected'));

        if (index >= 0 && index < items.length) {
            this.selectedIndex = index;
            items[index].classList.add('selected');
            items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            this.options.onItemSelect(this.options.items[index], index);
        }
    }

    handleKeyDown(e) {
        if (!this.container.offsetParent) return; // Only if visible
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectItem(Math.min(this.selectedIndex + 1, this.options.items.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectItem(Math.max(this.selectedIndex - 1, 0));
        }
    }
}

class BubbleMenu {
    constructor(options = {}) {
        this.options = {
            logo: '',
            items: [],
            menuBg: '#0f172a',
            menuContentColor: '#e5e7eb',
            animationDuration: 0.45,
            ...options
        };
        this.init();
    }

    init() {
        const menu = document.createElement('div');
        menu.className = 'bubble-menu';
        menu.style.position = 'fixed';
        menu.style.bottom = '24px';
        menu.style.right = '24px';

        const bubble = document.createElement('div');
        bubble.className = 'bubble menu-btn';
        bubble.innerHTML = `
      <div class="menu-content">
        <span class="menu-line"></span>
        <span class="menu-line short"></span>
      </div>
    `;

        const overlay = document.createElement('div');
        overlay.className = 'bubble-menu-items';
        overlay.innerHTML = `
      <div class="pill-list">
        ${this.options.items.map(item => `
          <a href="${item.href || '#'}" class="pill-link">${item.label}</a>
        `).join('')}
      </div>
    `;

        bubble.onclick = () => {
            overlay.classList.toggle('open');
            const lines = bubble.querySelectorAll('.menu-line');
            if (overlay.classList.contains('open')) {
                lines[0].style.transform = 'translateY(4px) rotate(45deg)';
                lines[1].style.transform = 'translateY(-4px) rotate(-45deg)';
                lines[1].classList.remove('short');
            } else {
                lines[0].style.transform = 'none';
                lines[1].style.transform = 'none';
                lines[1].classList.add('short');
            }
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) bubble.click();
        };

        document.body.appendChild(overlay);
        document.body.appendChild(menu);
        menu.appendChild(bubble);
    }
}

class ElectricBorder {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = {
            color: '#7c3aed',
            speed: 0.8,
            chaos: 0.1,
            borderRadius: 22,
            ...options
        };
        this.init();
    }

    init() {
        this.container.classList.add('electric-border');
        const glow = document.createElement('div');
        glow.className = 'eb-background-glow';
        this.container.prepend(glow);

        const canvas = document.createElement('canvas');
        canvas.className = 'eb-canvas';
        this.container.prepend(canvas);
        this.ctx = canvas.getContext('2d');

        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.animate();
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        this.ctx.canvas.width = rect.width;
        this.ctx.canvas.height = rect.height;
    }

    animate() {
        const { ctx } = this;
        const { width, height } = ctx.canvas;
        ctx.clearRect(0, 0, width, height);

        ctx.strokeStyle = this.options.color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        const time = Date.now() * 0.002 * this.options.speed;

        ctx.beginPath();
        // Simplified electric path around the border
        const r = this.options.borderRadius;
        const p = 2; // padding

        // Top
        for (let x = r; x < width - r; x += 5) {
            const y = p + Math.sin(x * 0.1 + time) * 2;
            x === r ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        // Right
        for (let y = r; y < height - r; y += 5) {
            const x = width - p + Math.cos(y * 0.1 + time) * 2;
            ctx.lineTo(x, y);
        }
        // Bottom
        for (let x = width - r; x > r; x -= 5) {
            const y = height - p + Math.sin(x * 0.1 + time) * 2;
            ctx.lineTo(x, y);
        }
        // Left
        for (let y = height - r; y > r; y -= 5) {
            const x = p + Math.cos(y * 0.1 + time) * 2;
            ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.stroke();

        requestAnimationFrame(() => this.animate());
    }
}

class Galaxy {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = {
            density: 0.75,
            glowIntensity: 0.25,
            twinkleIntensity: 0.25,
            rotationSpeed: 0.05,
            ...options
        };
        this.stars = [];
        this.init();
    }

    init() {
        this.container.classList.add('galaxy-container');
        const canvas = document.createElement('canvas');
        canvas.className = 'galaxy-canvas';
        this.container.appendChild(canvas);
        this.ctx = canvas.getContext('2d');

        this.createStars();
        window.addEventListener('resize', () => {
            this.resize();
            this.createStars();
        });
        this.resize();
        this.animate();
    }

    resize() {
        this.ctx.canvas.width = this.container.offsetWidth;
        this.ctx.canvas.height = this.container.offsetHeight;
    }

    createStars() {
        this.stars = [];
        const count = (this.ctx.canvas.width * this.ctx.canvas.height / 2000) * this.options.density;
        for (let i = 0; i < count; i++) {
            this.stars.push({
                x: Math.random() * this.ctx.canvas.width,
                y: Math.random() * this.ctx.canvas.height,
                size: Math.random() * 1.5,
                opacity: Math.random(),
                speed: 0.1 + Math.random() * 0.5
            });
        }
    }

    animate() {
        const { ctx } = this;
        const { width, height } = ctx.canvas;
        ctx.clearRect(0, 0, width, height);

        this.stars.forEach(star => {
            ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * this.options.twinkleIntensity * (0.5 + Math.sin(Date.now() * 0.001 * star.speed) * 0.5)})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });

        requestAnimationFrame(() => this.animate());
    }
}

window.AnimatedList = AnimatedList;
window.BubbleMenu = BubbleMenu;
window.ElectricBorder = ElectricBorder;
window.Galaxy = Galaxy;
