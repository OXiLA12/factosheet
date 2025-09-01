// Système de thème global pour FactoSheet
(function() {
    'use strict';

    // Initialiser le thème au chargement
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        setTheme(savedTheme);
    }

    // Définir un thème
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        // Mettre à jour l'icône du thème dans la navigation
        updateThemeIcon(theme);
        
        // Mettre à jour les toggles s'ils existent
        updateThemeToggles(theme);
    }

    // Mettre à jour l'icône du thème
    function updateThemeIcon(theme) {
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    }

    // Mettre à jour les toggles de thème
    function updateThemeToggles(theme) {
        // Toggle dans la page compte
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            if (theme === 'dark') {
                themeToggle.classList.add('active');
            } else {
                themeToggle.classList.remove('active');
            }
        }
        
        // Mettre à jour les aperçus de thème
        document.querySelectorAll('.theme-preview').forEach(preview => {
            preview.classList.remove('active');
        });
        const activePreview = document.querySelector(`.theme-${theme}`);
        if (activePreview) {
            activePreview.classList.add('active');
        }
    }

    // Basculer le thème
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
    }

    // Exposer les fonctions globalement
    window.setTheme = setTheme;
    window.toggleTheme = toggleTheme;
    window.toggleNavTheme = toggleTheme; // Alias pour la navigation

    // Initialiser au chargement du DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }
})();