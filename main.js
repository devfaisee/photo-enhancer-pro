// -------------------------------------------------------------
// Photo Upscaler & Restorer Pro - Core Controller & Pixel Engine
// -------------------------------------------------------------

// Active State
const state = {
  originalImage: null,
  imageName: "photo.jpg",
  origWidth: 0,
  origHeight: 0,
  dispWidth: 0,
  dispHeight: 0,
  
  // Custom Controls
  scaleFactor: 1, // 1x, 2x, 4x
  denoise: 0,
  sharpen: 3,
  vibrancy: 10,
  autoContrast: true,
  
  isDraggingSlider: false
};

// DOM References
let elDropZone, elFileInput, elThumbnail, elImgName, elImgDims, elBtnRemove;
let elUpscaleSelect, elDenoiseSlider, elDenoiseVal, elSharpenSlider, elSharpenVal;
let elVibrancySlider, elVibrancyVal, elCheckAutoContrast;
let elViewport, elPlaceholder, elSliderWrapper, elBeforeLayer, elAfterLayer;
let elCanvasBefore, elCanvasAfter, elSplitHandle;
let elBtnReset, elBtnEnhance, elBtnDownload;
let elProcessingOverlay;
let elHiddenSourceCanvas, elHiddenResultCanvas;

document.addEventListener("DOMContentLoaded", () => {
  cacheDomElements();
  bindEventHandlers();
  initComparisonSlider();
});

function cacheDomElements() {
  elDropZone = document.getElementById("drop-zone");
  elFileInput = document.getElementById("file-input");
  elThumbnail = document.getElementById("thumbnail-wrapper");
  elImgName = document.getElementById("img-name");
  elImgDims = document.getElementById("img-dims");
  elBtnRemove = document.getElementById("btn-remove-image");
  
  elUpscaleSelect = document.getElementById("upscale-select");
  elDenoiseSlider = document.getElementById("range-denoise");
  elDenoiseVal = document.getElementById("val-denoise");
  elSharpenSlider = document.getElementById("range-sharpen");
  elSharpenVal = document.getElementById("val-sharpen");
  elVibrancySlider = document.getElementById("range-vibrancy");
  elVibrancyVal = document.getElementById("val-vibrancy");
  elCheckAutoContrast = document.getElementById("check-auto-contrast");
  
  elViewport = document.getElementById("editor-viewport");
  elPlaceholder = document.getElementById("editor-placeholder");
  elSliderWrapper = document.getElementById("split-slider-wrapper");
  elBeforeLayer = document.getElementById("before-layer");
  elAfterLayer = document.getElementById("after-layer");
  elCanvasBefore = document.getElementById("canvas-before");
  elCanvasAfter = document.getElementById("canvas-after");
  elSplitHandle = document.getElementById("split-handle");
  
  elBtnReset = document.getElementById("btn-reset");
  elBtnEnhance = document.getElementById("btn-enhance");
  elBtnDownload = document.getElementById("btn-download");
  elProcessingOverlay = document.getElementById("processing-overlay");
  
  elHiddenSourceCanvas = document.getElementById("hidden-source-canvas");
  elHiddenResultCanvas = document.getElementById("hidden-result-canvas");
}

function bindEventHandlers() {
  
  // Drag Drop files
  elDropZone.addEventListener("click", () => elFileInput.click());
  elFileInput.addEventListener("change", handleFileSelect);
  
  elDropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    elDropZone.classList.add("dragover");
  });
  
  elDropZone.addEventListener("dragleave", () => {
    elDropZone.classList.remove("dragover");
  });
  
  elDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    elDropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      elFileInput.files = e.dataTransfer.files;
      handleFileSelect();
    }
  });

  elBtnRemove.addEventListener("click", resetWorkspace);
  elBtnReset.addEventListener("click", resetSliders);

  // Sliders UI value updates
  elUpscaleSelect.addEventListener("change", (e) => {
    state.scaleFactor = parseInt(e.target.value);
  });

  elDenoiseSlider.addEventListener("input", (e) => {
    state.denoise = parseInt(e.target.value);
    elDenoiseVal.textContent = state.denoise === 0 ? "0 (None)" : `${state.denoise} (Smooth)`;
  });

  elSharpenSlider.addEventListener("input", (e) => {
    state.sharpen = parseInt(e.target.value);
    let txt = "Balanced";
    if (state.sharpen === 0) txt = "None";
    else if (state.sharpen < 4) txt = "Balanced";
    else if (state.sharpen < 8) txt = "Sharp Outline";
    else txt = "Extreme High-Pass";
    elSharpenVal.textContent = `${state.sharpen} (${txt})`;
  });

  elVibrancySlider.addEventListener("input", (e) => {
    state.vibrancy = parseInt(e.target.value);
    elVibrancyVal.textContent = `${state.vibrancy}%`;
  });

  elCheckAutoContrast.addEventListener("change", (e) => {
    state.autoContrast = e.target.checked;
  });

  // Enhance trigger
  elBtnEnhance.addEventListener("click", executeEnhancementPipeline);
  
  // Download clean file
  elBtnDownload.addEventListener("click", triggerDownloadEnhancedImage);
}

// --- Image Load Triggers ---
function handleFileSelect() {
  const file = elFileInput.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Unsupported File: Please choose an image format (PNG, JPG, WebP).");
    return;
  }

  state.imageName = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      state.originalImage = img;
      setupWorkspace(img);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function setupWorkspace(img) {
  state.origWidth = img.naturalWidth;
  state.origHeight = img.naturalHeight;

  // Calculate viewport boundaries
  const maxW = elViewport.clientWidth - 32;
  const maxH = elViewport.clientHeight - 32;

  let w = state.origWidth;
  let h = state.origHeight;
  if (w > maxW) {
    h = (maxW / w) * h;
    w = maxW;
  }
  if (h > maxH) {
    w = (maxH / h) * w;
    h = maxH;
  }

  state.dispWidth = Math.round(w);
  state.dispHeight = Math.round(h);

  // Setup visible canvases
  elCanvasBefore.width = state.dispWidth;
  elCanvasBefore.height = state.dispHeight;
  elCanvasAfter.width = state.dispWidth;
  elCanvasAfter.height = state.dispHeight;

  // Set sizes on containers
  elSliderWrapper.style.width = `${state.dispWidth}px`;
  elSliderWrapper.style.height = `${state.dispHeight}px`;
  elBeforeLayer.style.width = "50%";
  elSplitHandle.style.left = "50%";

  // Canvas-before matches exactly the wrapper width so it crops rather than squashes
  elCanvasBefore.style.width = `${state.dispWidth}px`;
  elCanvasBefore.style.height = `${state.dispHeight}px`;

  // Setup offscreen canvas sizes
  elHiddenSourceCanvas.width = state.origWidth;
  elHiddenSourceCanvas.height = state.origHeight;

  // Draw source image onto canvas
  const ctxBefore = elCanvasBefore.getContext("2d");
  const ctxAfter = elCanvasAfter.getContext("2d");
  const ctxHiddenSrc = elHiddenSourceCanvas.getContext("2d");

  ctxBefore.drawImage(img, 0, 0, state.dispWidth, state.dispHeight);
  ctxAfter.drawImage(img, 0, 0, state.dispWidth, state.dispHeight);
  ctxHiddenSrc.drawImage(img, 0, 0, state.origWidth, state.origHeight);

  // Toggle UI
  elDropZone.style.display = "none";
  elThumbnail.style.display = "flex";
  elImgName.textContent = state.imageName;
  elImgDims.textContent = `${state.origWidth} x ${state.origHeight} px`;

  elPlaceholder.style.display = "none";
  elSliderWrapper.style.display = "flex";

  document.getElementById("image-status-badge").textContent = "Photo Loaded";
  document.getElementById("image-status-badge").className = "badge";

  elBtnReset.disabled = false;
  elBtnEnhance.disabled = false;
  elBtnDownload.disabled = true; // Disabled until enhancement runs!
}

function resetWorkspace() {
  state.originalImage = null;
  elFileInput.value = "";
  
  elDropZone.style.display = "flex";
  elThumbnail.style.display = "none";
  elPlaceholder.style.display = "flex";
  elSliderWrapper.style.display = "none";

  document.getElementById("image-status-badge").textContent = "No Photo Loaded";
  document.getElementById("image-status-badge").className = "badge";

  elBtnReset.disabled = true;
  elBtnEnhance.disabled = true;
  elBtnDownload.disabled = true;
}

function resetSliders() {
  elUpscaleSelect.value = "1";
  state.scaleFactor = 1;

  state.denoise = 0;
  elDenoiseSlider.value = 0;
  elDenoiseVal.textContent = "0 (None)";

  state.sharpen = 3;
  elSharpenSlider.value = 3;
  elSharpenVal.textContent = "3 (Balanced)";

  state.vibrancy = 10;
  elVibrancySlider.value = 10;
  elVibrancyVal.textContent = "10%";

  state.autoContrast = true;
  elCheckAutoContrast.checked = true;

  if (state.originalImage) {
    const ctxAfter = elCanvasAfter.getContext("2d");
    ctxAfter.drawImage(state.originalImage, 0, 0, state.dispWidth, state.dispHeight);
    elBtnDownload.disabled = true;
  }
}

// --- Interactive vertical comparison slider splits ---
function initComparisonSlider() {
  const startDrag = (e) => {
    state.isDraggingSlider = true;
    e.preventDefault();
  };

  const stopDrag = () => {
    state.isDraggingSlider = false;
  };

  const onDrag = (clientX) => {
    if (!state.isDraggingSlider || !state.originalImage) return;

    const rect = elSliderWrapper.getBoundingClientRect();
    let x = clientX - rect.left;

    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;

    const pct = (x / rect.width) * 100;
    elBeforeLayer.style.width = `${pct}%`;
    elSplitHandle.style.left = `${pct}%`;
  };

  elSplitHandle.addEventListener("mousedown", startDrag);
  window.addEventListener("mouseup", stopDrag);
  window.addEventListener("mousemove", (e) => onDrag(e.clientX));

  // Touch Support
  elSplitHandle.addEventListener("touchstart", startDrag);
  window.addEventListener("touchend", stopDrag);
  window.addEventListener("touchmove", (e) => {
    if (e.touches.length > 0) {
      onDrag(e.touches[0].clientX);
    }
  });
}

// --- Core Photo Restoration Algorithms ---
function executeEnhancementPipeline() {
  if (!state.originalImage) return;

  elProcessingOverlay.style.display = "flex";

  // Defer execution slightly to let UI render the processing layout
  setTimeout(() => {
    try {
      const tStart = performance.now();

      // 1. Calculate target output high-resolution sizes
      const outW = state.origWidth * state.scaleFactor;
      const outH = state.origHeight * state.scaleFactor;

      elHiddenResultCanvas.width = outW;
      elHiddenResultCanvas.height = outH;

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = outW;
      tempCanvas.height = outH;

      const tempCtx = tempCanvas.getContext("2d");

      // 2. Perform Lanczos-like High-Quality Hardware-Accelerated Resampling
      tempCtx.imageSmoothingEnabled = true;
      tempCtx.imageSmoothingQuality = "high";
      tempCtx.drawImage(state.originalImage, 0, 0, outW, outH);

      // Get pixel data block
      const imgData = tempCtx.getImageData(0, 0, outW, outH);
      const data = imgData.data;

      // 3. Bilateral Denoising / Edge Selective Blur Filter
      if (state.denoise > 0) {
        applyEdgeSelectiveBilateralDenoise(data, outW, outH, state.denoise);
      }

      // 4. Color Vibrancy & Saturation restoration
      if (state.vibrancy > 0) {
        applyColorVibrancyCorrection(data, state.vibrancy / 100);
      }

      // 5. Auto-Contrast Histogram Stretching
      if (state.autoContrast) {
        applyAdaptiveHistogramStretch(data);
      }

      // 6. Unsharp Mask / Custom Laplacian Convolution Sharpening
      if (state.sharpen > 0) {
        applyConvolutionSharpeningFilter(data, outW, outH, state.sharpen);
      }

      // 7. Render output back onto result canvas
      const ctxResult = elHiddenResultCanvas.getContext("2d");
      ctxResult.putImageData(imgData, 0, 0);

      // Render onto screen viewport canvas downscaled to display bounds
      const ctxAfter = elCanvasAfter.getContext("2d");
      ctxAfter.clearRect(0, 0, state.dispWidth, state.dispHeight);
      ctxAfter.drawImage(elHiddenResultCanvas, 0, 0, state.dispWidth, state.dispHeight);

      const tEnd = performance.now();
      console.log(`Photo enhanced in ${(tEnd - tStart).toFixed(2)} ms.`);

      // Open compare slider to 50% to let them appreciate the difference!
      elBeforeLayer.style.width = "50%";
      elSplitHandle.style.left = "50%";

      // Update badges
      document.getElementById("image-status-badge").textContent = `Enhanced (${outW}x${outH})`;
      document.getElementById("image-status-badge").className = "badge green";

      elBtnDownload.disabled = false;

    } catch (err) {
      console.error("Enhance failed.", err);
      alert("Error: Computation pipeline encountered memory boundaries.");
    } finally {
      elProcessingOverlay.style.display = "none";
    }
  }, 100);
}

// --- Mathematical Filters implementations ---

// Fast Edge Selective Smoothing (approximates Bilateral Filtering)
function applyEdgeSelectiveBilateralDenoise(data, w, h, strength) {
  const radius = Math.min(3, Math.ceil(strength / 3));
  const threshold = 15 + strength * 4; // intensity difference threshold
  
  // Clone image array to read original pixels during blur convolution
  const orig = new Uint8ClampedArray(data);

  for (let y = radius; y < h - radius; y++) {
    for (let x = radius; x < w - radius; x++) {
      const idx = (y * w + x) * 4;
      
      const r_orig = orig[idx];
      const g_orig = orig[idx+1];
      const b_orig = orig[idx+2];

      let r_sum = 0, g_sum = 0, b_sum = 0, w_sum = 0;

      // Spatial window kernel convolution
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const nIdx = ((y + ky) * w + (x + kx)) * 4;
          
          const r_n = orig[nIdx];
          const g_n = orig[nIdx+1];
          const b_n = orig[nIdx+2];

          // Compute color difference (Photometric similarity)
          const diff = Math.sqrt(
            (r_orig - r_n) * (r_orig - r_n) +
            (g_orig - g_n) * (g_orig - g_n) +
            (b_orig - b_n) * (b_orig - b_n)
          );

          if (diff < threshold) {
            // High weight for similar color pixels (denoises solid backgrounds)
            const weight = 1 - (diff / threshold);
            r_sum += r_n * weight;
            g_sum += g_n * weight;
            b_sum += b_n * weight;
            w_sum += weight;
          }
        }
      }

      if (w_sum > 0) {
        data[idx] = Math.round(r_sum / w_sum);
        data[idx+1] = Math.round(g_sum / w_sum);
        data[idx+2] = Math.round(b_sum / w_sum);
      }
    }
  }
}

// Saturation increase and Color Vibrancy Restorer
function applyColorVibrancyCorrection(data, amount) {
  const factor = 1 + amount;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    
    // Gray value
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Interpolate towards gray scale based on factor (factor > 1 increases colorfulness!)
    data[i] = Math.min(255, Math.max(0, gray + (r - gray) * factor));
    data[i+1] = Math.min(255, Math.max(0, gray + (g - gray) * factor));
    data[i+2] = Math.min(255, Math.max(0, gray + (b - gray) * factor));
  }
}

// Global Histogram stretching to maximize contrast automatically
function applyAdaptiveHistogramStretch(data) {
  let minL = 255, maxL = 0;
  
  // 1. Find min/max luminance in image
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    
    if (luma < minL) minL = luma;
    if (luma > maxL) maxL = luma;
  }

  // Prevent division by zero
  if (maxL - minL < 10) return;

  const stretchFactor = 255 / (maxL - minL);

  // 2. Perform stretch contrast balance
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, (data[i] - minL) * stretchFactor));
    data[i+1] = Math.min(255, Math.max(0, (data[i+1] - minL) * stretchFactor));
    data[i+2] = Math.min(255, Math.max(0, (data[i+2] - minL) * stretchFactor));
  }
}

// 3x3 Sharpening Convolution Filter (Unsharp-Mask equivalent detail recovery)
function applyConvolutionSharpeningFilter(data, w, h, strength) {
  const orig = new Uint8ClampedArray(data);
  const factor = strength * 0.15; // Sharpening coefficient

  // 3x3 Sharpen Kernel:
  // [ 0, -k,  0]
  // [-k, 1+4k, -k]
  // [ 0, -k,  0]
  const k = factor;
  const centerWeight = 1 + 4 * k;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;

      const r_center = orig[idx];
      const g_center = orig[idx+1];
      const b_center = orig[idx+2];

      // Calculate neighbor convolutions
      const topIdx = ((y - 1) * w + x) * 4;
      const bottomIdx = ((y + 1) * w + x) * 4;
      const leftIdx = (y * w + (x - 1)) * 4;
      const rightIdx = (y * w + (x + 1)) * 4;

      const r_adj = orig[topIdx] + orig[bottomIdx] + orig[leftIdx] + orig[rightIdx];
      const g_adj = orig[topIdx] + orig[bottomIdx] + orig[leftIdx] + orig[rightIdx];
      const b_adj = orig[topIdx] + orig[bottomIdx] + orig[leftIdx] + orig[rightIdx];

      data[idx] = Math.min(255, Math.max(0, r_center * centerWeight - r_adj * k));
      data[idx+1] = Math.min(255, Math.max(0, g_center * centerWeight - g_adj * k));
      data[idx+2] = Math.min(255, Math.max(0, b_center * centerWeight - b_adj * k));
    }
  }
}

// --- File Exporter ---
function triggerDownloadEnhancedImage() {
  if (!state.originalImage) return;

  const downloadUrl = elHiddenResultCanvas.toDataURL("image/png");
  
  const baseName = state.imageName.substring(0, state.imageName.lastIndexOf(".")) || "photo";
  const downloadName = `${baseName}_enhanced.png`;

  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = downloadName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
