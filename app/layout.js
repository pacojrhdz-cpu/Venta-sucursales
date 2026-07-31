import './globals.css';
import Shell from '../components/Shell';

export const metadata = {
  title: 'Ventas por Sucursal',
  description: 'Panel administrativo de ventas, objetivos, gastos y bonos',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
