import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "../services/growthTelemetry";

export default function GrowthTelemetry() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname, location.search);
  }, [location.pathname, location.search]);
  return null;
}

