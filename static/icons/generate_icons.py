#!/usr/bin/env python3
"""
Générateur d'icônes SVG pour la PWA FactoSheet
"""

import os

def create_svg_icon(size, filename):
    """Créer une icône SVG avec le logo FactoSheet"""
    svg_content = f'''<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" xmlns="http://www.w3.org/2000/svg">
    <!-- Fond dégradé -->
    <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#4CAF50;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#81C784;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#2E7D32;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#4CAF50;stop-opacity:1" />
        </linearGradient>
    </defs>
    
    <!-- Fond principal -->
    <rect width="{size}" height="{size}" rx="{size//8}" fill="url(#grad1)"/>
    
    <!-- Icône document -->
    <g transform="translate({size*0.2},{size*0.15})">
        <rect width="{size*0.6}" height="{size*0.7}" rx="{size//20}" fill="white" fill-opacity="0.95"/>
        <rect x="{size*0.08}" y="{size*0.12}" width="{size*0.44}" height="{size//25}" fill="url(#grad2)"/>
        <rect x="{size*0.08}" y="{size*0.2}" width="{size*0.35}" height="{size//30}" fill="#666"/>
        <rect x="{size*0.08}" y="{size*0.26}" width="{size*0.4}" height="{size//30}" fill="#666"/>
        <rect x="{size*0.08}" y="{size*0.32}" width="{size*0.3}" height="{size//30}" fill="#666"/>
        
        <!-- Icône IA -->
        <circle cx="{size*0.45}" cy="{size*0.45}" r="{size*0.08}" fill="url(#grad2)"/>
        <text x="{size*0.45}" y="{size*0.48}" text-anchor="middle" fill="white" font-family="Arial" font-size="{size//10}" font-weight="bold">AI</text>
    </g>
    
    <!-- Logo F -->
    <text x="{size*0.5}" y="{size*0.9}" text-anchor="middle" fill="white" font-family="Arial" font-size="{size//6}" font-weight="bold">F</text>
</svg>'''
    
    with open(filename, "w", encoding="utf-8") as f:
        f.write(svg_content)
    
    print(f"Icône créée: {filename} ({size}x{size})")

# Générer toutes les tailles d'icônes PWA
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for size in sizes:
    create_svg_icon(size, f"icon-{size}x{size}.svg")

print("✅ Toutes les icônes SVG ont été générées!")