// ABOUTME: UI module for Smart Highlights—owns UI, CSS, palette, icons, and overlays.
// Exposes a tiny API via window.SmartUI for content logic to use.
(function () {
    let currentHighlightColor = 'rgba(255, 255, 0, 0.5)';
    const style = document.createElement('style');
  
    const colorPalette = [
      { name: 'Yellow', color: 'rgba(255, 255, 0, 0.5)', textColor: 'black' },
      { name: 'Green',  color: 'rgba(0, 255, 0, 0.3)',   textColor: 'black' },
      { name: 'Orange', color: 'rgba(255, 165, 0, 0.5)', textColor: 'black' },
      { name: 'Purple', color: 'rgba(150, 0, 255, 0.3)', textColor: 'white' },
      { name: 'Red',    color: 'rgba(255, 0, 0, 0.3)',   textColor: 'white' }
    ];
  
    function getTextColor(backgroundColor) {
      const c = colorPalette.find(x => x.color === backgroundColor);
      return c ? c.textColor : 'black';
    }
  
    function injectHighlightCSS() {
      const textColor = getTextColor(currentHighlightColor);
      style.textContent = `
    .smart-highlight {
      background-color: ${currentHighlightColor};
      color: ${textColor} !important;
      padding: 2px 4px !important;
      border-radius: 3px !important;
      font-weight: bold !important;
    }
    .smart-highlights-button {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      background: rgba(0, 123, 255, 0.8);
      border: none;
      border-radius: 50%;
      cursor: pointer;
      z-index: 10000;
      color: white;
      display: none;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      font-size: 16px;
      font-weight: bold;
    }
    .smart-highlights-button:hover:not(:disabled) {
      background: rgba(0, 123, 255, 1);
      transform: scale(1.05);
    }
    .smart-highlights-button:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none;
    }
    .smart-highlights-button:disabled.loading {
      animation: pulse-loading 1.5s ease-in-out infinite alternate;
    }
    .smart-highlights-button.loading svg {
      animation: spin-smooth 1s linear infinite;
    }
    @keyframes spin-smooth { to { transform: rotate(360deg); } }
    @keyframes pulse-loading {
      from { box-shadow: 0 2px 8px rgba(0,0,0,0.2), 0 0 0 0 rgba(0,123,255,0.6); }
      to   { box-shadow: 0 2px 8px rgba(0,0,0,0.2), 0 0 0 8px rgba(0,123,255,0); }
    }
    .color-picker-popup {
      position: fixed;
      top: 70px;
      right: 15px;
      background: transparent;
      border: none;
      border-radius: 8px;
      padding: 10px;
      box-shadow: none;
      z-index: 10002;
      display: none;
      opacity: 0;
      transition: opacity 0.3s ease;
      flex-direction: column;
      gap: 6px;
    }
    .color-picker-popup.show { display: flex; opacity: 1; }
    .color-swatch {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid #888;
      transition: transform 0.2s, border-color 0.2s, border-width 0.2s;
      position: relative;
      background-color: rgba(250,250,250,0.71);
    }
    .color-swatch::before {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: calc(100% - 6px);
      height: calc(100% - 6px);
      border-radius: 50%;
      background-color: var(--swatch-color-opaque);
      z-index: 1;
    }
    .color-swatch:hover { transform: scale(1.1); border-color: #888; }
    .color-swatch.selected {
      border-color: #4A90E2;
      border-width: 4px;
      box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.2);
    }
    .smart-highlights-overlay {
      position: fixed;
      top: 70px;
      right: 20px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      z-index: 10001;
      font-size: 14px;
      transition: opacity 0.3s ease;
    }`;
      if (!style.parentNode) document.head.appendChild(style);
    }
  
    const LUCIDE_ICONS = {
      elephant: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-elephant-icon lucide-elephant"><path d="M14.5 12H14c-2.8 0-5-2.2-5-5V5a2 2 0 0 1 2-2h2c1.5 0 2.8.8 3.4 2H19c1.7 0 3 1.3 3 3v10"/><path d="M18 10h.01"/><path d="M14 10a4 4 0 0 0 4 4 4 4 0 0 1 4 4 2 2 0 0 1-4 0"/><path d="M10 16v5"/><path d="M18 14a4 4 0 0 0-4 4v3H6v-2.6c0-1.1-.8-2.3-1.7-3C2.9 14.3 2 12.8 2 11c0-3.3 3.1-6 7-6"/><path d="M2 11v7"/></svg>`,
      loader:   `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="6"/><line x1="12" x2="12" y1="18" y2="22"/><line x1="4.93" x2="7.76" y1="4.93" y2="7.76"/><line x1="16.24" x2="19.07" y1="16.24" y2="19.07"/><line x1="2" x2="6" y1="12" y2="12"/><line x1="18" x2="22" y1="12" y2="12"/><line x1="4.93" x2="7.76" y1="19.07" y2="16.24"/><line x1="16.24" x2="19.07" y1="7.76" y2="4.93"/></svg>`
    };
  
    const PALETTE_SHOW_DELAY = 800;
    const PALETTE_HIDE_DELAY = 500;
    let showTimer = null;
    let hideTimer = null;
  
    const floatingButton = document.createElement('button');
    floatingButton.className = 'smart-highlights-button';
    floatingButton.title = '';
    const colorPicker = document.createElement('div');
    colorPicker.className = 'color-picker-popup';
  
    function setButtonIcon(iconName, isLoading = false) {
      const iconSVG = LUCIDE_ICONS[iconName] || LUCIDE_ICONS.elephant;
      floatingButton.innerHTML = iconSVG;
      if (isLoading) floatingButton.classList.add('loading');
      else floatingButton.classList.remove('loading');
    }
  
    function clearPaletteTimers() {
      if (showTimer) { clearTimeout(showTimer); showTimer = null; }
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    }
  
    function showPalette() {
      clearPaletteTimers();
      colorPicker.classList.add('show');
      colorPicker.querySelectorAll('.color-swatch').forEach(swatch => {
        if (swatch.dataset.color === currentHighlightColor) swatch.classList.add('selected');
        else swatch.classList.remove('selected');
      });
    }
  
    function hidePalette() {
      clearPaletteTimers();
      colorPicker.classList.remove('show');
    }
  
    function showStatusOverlay(message, type = 'info') {
      const existing = document.querySelector('.smart-highlights-overlay');
      if (existing) existing.remove();
      const overlay = document.createElement('div');
      overlay.className = 'smart-highlights-overlay';
      const prefixes = { info: '[i]', success: '[✓]', warning: '[!]', error: '[×]' };
      const colors   = { info: 'rgba(0, 123, 255, 0.8)', success: 'rgba(0, 128, 0, 0.8)', warning: 'rgba(255, 165, 0, 0.8)', error: 'rgba(255, 0, 0, 0.8)' };
      overlay.textContent = `${prefixes[type] || prefixes.info} ${message}`;
      overlay.style.backgroundColor = colors[type] || colors.info;
      document.body.appendChild(overlay);
      return overlay;
    }
  
    function setColor(color) {
      currentHighlightColor = color;
      injectHighlightCSS();
      const tc = getTextColor(color);
      document.querySelectorAll('.smart-highlight').forEach(h => {
        h.style.backgroundColor = color;
        h.style.color = tc;
      });
    }
  
    function setButtonVisible(visible) {
      floatingButton.style.display = visible ? 'flex' : 'none';
    }
  
    function init({ currentHighlightColor: initialColor, onColorChange, onClick }) {
      currentHighlightColor = initialColor || currentHighlightColor;
  
      // Build swatches
      colorPalette.forEach(({ name, color }) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.title = name;
        swatch.dataset.color = color;
        swatch.style.setProperty('--swatch-color-opaque', color.replace(/,\s*[\d.]+\)$/, ', 1)'));
        colorPicker.appendChild(swatch);
      });
  
      // Attach DOM
      document.head.appendChild(style);
      document.body.appendChild(floatingButton);
      document.body.appendChild(colorPicker);
  
      // Initial CSS + icon
      injectHighlightCSS();
      setButtonIcon('elephant', false);
  
      // Hover to show palette
      floatingButton.addEventListener('mouseenter', () => {
        clearPaletteTimers();
        showTimer = setTimeout(() => showPalette(), PALETTE_SHOW_DELAY);
      });
      floatingButton.addEventListener('mouseleave', () => {
        if (showTimer) { clearTimeout(showTimer); showTimer = null; }
        if (colorPicker.classList.contains('show')) {
          hideTimer = setTimeout(() => hidePalette(), PALETTE_HIDE_DELAY);
        }
      });
  
      // Palette hover keep-open
      colorPicker.addEventListener('mouseenter', () => {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        showPalette();
      });
      colorPicker.addEventListener('mouseleave', () => {
        hideTimer = setTimeout(() => hidePalette(), PALETTE_HIDE_DELAY);
      });
  
      // Swatch click
      colorPicker.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!e.target.classList.contains('color-swatch')) return;
        const color = e.target.dataset.color;
        if (typeof onColorChange === 'function') onColorChange(color);
        colorPicker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        e.target.classList.add('selected');
        setTimeout(() => hidePalette(), 300);
      });
  
      // Button click
      floatingButton.addEventListener('click', async () => {
        if (floatingButton.disabled) return;
        clearPaletteTimers();
        hidePalette();
        if (typeof onClick === 'function') await onClick();
      });
    }
  
    window.SmartUI = {
      init,
      injectHighlightCSS,
      setButtonIcon,
      showStatusOverlay,
      setColor,
      getTextColor,
      setButtonVisible
    };
  })();