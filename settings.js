// Settings - Mouse Sensitivity
const slider = document.getElementById('sensitivitySlider');
const sensLabel = document.getElementById('sensValue');

// Load saved sensitivity from localStorage
const savedSens = localStorage.getItem('mouseSensitivity');
if (savedSens) {
    mouseSensitivity = parseFloat(savedSens);
    slider.value = mouseSensitivity;
    sensLabel.textContent = mouseSensitivity.toFixed(1);
}

slider.addEventListener('input', () => {
    mouseSensitivity = parseFloat(slider.value);
    sensLabel.textContent = mouseSensitivity.toFixed(1);
    localStorage.setItem('mouseSensitivity', mouseSensitivity);
});
