import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Enhanced PDF Reader",
    description: "Advanced PDF Reader with AI Assistant, Highlights, and Notes",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                {/* Inter font from Google Fonts */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin="anonymous"
                />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
                    rel="stylesheet"
                />
                {/* Quill Rich Text Editor styles */}
                <link
                    href="https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.snow.css"
                    rel="stylesheet"
                />
            </head>
            <body>{children}</body>
        </html>
    );
}
