import { Route, Routes } from "react-router-dom";
import RequireAuth from "./auth/RequireAuth";
import Home from "./pages/Home";
import ExercisesPage from "./pages/Exercises";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Account from "./pages/Account";
import WorkoutPage from "./pages/Workout";
import ProgressPage from "./pages/Progress";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/exercises" element={<ExercisesPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<RequireAuth />}>
        <Route path="/account" element={<Account />} />
        <Route path="/workout" element={<WorkoutPage />} />
        <Route path="/progress" element={<ProgressPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
