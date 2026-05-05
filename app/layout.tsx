import "./globals.css";
import Navbar from "./components/Navbar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#050A11] text-white">
        <div className="p-3 sm:p-6">
          
          {children}
        </div>
      </body>
    </html>
  );
}