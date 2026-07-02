import LoginForm from "@/components/LoginForm";
import { FIGURES } from "@/components/WalkingFigures";
import styles from "./page.module.css";

export default function Home() {
  const [FigureA, FigureB, FigureC, FigureD] = FIGURES;

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <span className={styles.wordmark}>PayEdu</span>
      </header>

      <main className={styles.stage}>
        <div className={styles.figures} aria-hidden="true">
          <FigureA className={styles.figure} />
          <FigureB className={styles.figure} />
        </div>

        <div className={styles.cardArea}>
          <LoginForm />
        </div>

        <div className={styles.figures} aria-hidden="true">
          <FigureC className={styles.figure} />
          <FigureD className={styles.figure} />
        </div>
      </main>
    </div>
  );
}
