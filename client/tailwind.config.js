/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./**/*.{js,ts,jsx,tsx}",
        "!./node_modules/**"
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
            },
            colors: {
                'idf-green': '#82d682', // The main green background
                'idf-bg': '#f5f7fa',
                'idf-dark': '#1f2937',
                'idf-yellow': '#fcd34d', // The yellow accent button
                'idf-yellow-hover': '#fbbf24',
                'idf-card-border': '#e2e8f0',
            },
            boxShadow: {
                'portal': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
            }
        },
    },
    plugins: [],
}
