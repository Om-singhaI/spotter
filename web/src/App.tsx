import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import ExercisesPage from "./pages/Exercises";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/exercises" element={<ExercisesPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
