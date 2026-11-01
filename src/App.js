import React, { useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import CreateUser from "./pages/CreateUser";
import AddHealth from "./pages/AddHealth";
import HealthHistory from "./pages/HealthHistory";
import HealthProgress from "./pages/HealthProgress";
import Profile from "./pages/Profile";
import GuestHealth from "./pages/GuestHealth";
import EmailReview from "./pages/EmailReview";
import PatientLogin from "./pages/PatientLogin";
import PatientDashboard from "./pages/PatientDashboard";
import PatientSettings from "./pages/PatientSettings";
import AdminLogin from "./pages/AdminLogin";
import AdminForgotPassword from "./pages/AdminForgotPassword";
import AdminResetPassword from "./pages/AdminResetPassword";
import AdminDashboard from "./pages/AdminDashboard";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import { Button, Notice, PublicLayout } from "./components/ui";
import {
  getApiError,
  getPatientProfile,
  getStoredPatient,
  getSessionSnapshot,
  hasAdminSession,
  hasPatientSession,
  initializeSessions,
  restoreSession,
  retryLogout,
  subscribeSessions,
  storePatientProfile,
} from "./api/api";
import { getLandingDestination, normalizePathname } from "./utils/navigation";
import ServerReadinessNotice from "./components/ServerReadinessNotice";
import LoadingScreen from "./components/LoadingScreen";
import { LoadingScreenProvider } from "./components/LoadingScreenContext";

const PUBLIC_ADMIN_AUTH_PATHS = new Set(["/admin/login", "/admin/forgot-password", "/admin/reset-password"]);
const isPublicAdminAuthPath = pathname => PUBLIC_ADMIN_AUTH_PATHS.has(normalizePathname(pathname));

function SessionBoundary({ scope, children }) {
  const scopes = Array.isArray(scope) ? scope : [scope];
  const sessions = scopes.map(getSessionSnapshot);
  if (sessions.some((session) => ["unknown", "loading"].includes(session.status)))
    return <LoadingScreen />;
  const failed = sessions.filter((session) => session.status === "error");
  if (failed.length)
    return <PublicLayout><Notice tone="error">{failed.some(session => session.error?.code === "API_NOT_READY")
      ? getApiError(failed.find(session => session.error?.code === "API_NOT_READY").error)
      : failed.some(session => session.error?.code === "SESSION_SERVICE_UNAVAILABLE")
      ? "ระบบเข้าสู่ระบบยังไม่พร้อมให้บริการ กรุณาติดต่อเจ้าหน้าที่ หรือบันทึกข้อมูลโดยไม่เข้าสู่ระบบ"
      : "ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง"}</Notice>
      <Button variant="secondary" onClick={() => Promise.allSettled(failed.map((session) => restoreSession(session.scope, { force: true })))}>ลองอีกครั้ง</Button>
      <a className="btn btn-secondary" href="/guest">บันทึกโดยไม่เข้าสู่ระบบ</a></PublicLayout>;
  return children;
}

function LogoutNotice() {
  const [failures, setFailures] = useState({});
  const [retrying, setRetrying] = useState(null);
  useEffect(() => {
    const failed = (event) => setFailures((previous) => ({ ...previous, [event.detail?.scope]: true }));
    window.addEventListener("carevigo:logout-failed", failed);
    return () => window.removeEventListener("carevigo:logout-failed", failed);
  }, []);
  const pending = ["patient", "admin"].find((scope) => {
    const session = getSessionSnapshot(scope);
    return session.logoutPending && (session.error || failures[scope]);
  });
  if (!pending) return null;
  async function retry() {
    setRetrying(pending);
    try { await retryLogout(pending); }
    catch { /* Keep the retry visible while the server is unavailable. */ }
    finally { setRetrying(null); }
  }
  return <Notice tone="error">ยังออกจากระบบบนเซิร์ฟเวอร์ไม่สำเร็จ ข้อมูลบัญชีบนหน้านี้ถูกปิดแล้ว กรุณาเชื่อมต่ออินเทอร์เน็ตและลองอีกครั้ง
    <Button variant="secondary" loading={retrying === pending} onClick={retry}>ออกจากระบบอีกครั้ง</Button></Notice>;
}

function PasswordChangeNotice() {
  const [feedback, setFeedback] = useState(null);
  useEffect(() => {
    const updated = (event) => {
      const detail = event.detail;
      if (!["patient", "admin"].includes(detail?.scope)) return;
      const session = getSessionSnapshot(detail.scope);
      if (session.status === "authenticated" && session.sessionId === detail.sessionId)
        setFeedback(detail);
    };
    const discard = () => setFeedback((current) => {
      if (!current) return null;
      const session = getSessionSnapshot(current.scope);
      return session.status === "authenticated" && session.sessionId === current.sessionId ? current : null;
    });
    window.addEventListener("carevigo:password-updated", updated);
    const unsubscribe = subscribeSessions(discard);
    return () => { window.removeEventListener("carevigo:password-updated", updated); unsubscribe(); };
  }, []);
  if (!feedback) return null;
  return <div style={{ position: "fixed", right: "16px", bottom: "16px", zIndex: 1200, maxWidth: "560px", width: "calc(100% - 32px)", maxHeight: "calc(100vh - 32px)", overflow: "auto", boxShadow: "0 8px 30px #153d3526", borderRadius: "12px" }}>
    <Notice tone="success"><span>เปลี่ยนรหัสผ่านเรียบร้อยแล้ว</span>
      <Button variant="secondary" onClick={() => setFeedback(null)}>ปิดข้อความ</Button>
    </Notice>
  </div>;
}

function NavigationEffects() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = normalizePathname(location.pathname);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const leaveAdmin = (expired) => {
      if (
        ((pathname === "/admin" || pathname.startsWith("/admin/")) &&
          !isPublicAdminAuthPath(pathname)) ||
        pathname === "/register"
      )
        navigate("/admin/login", {
          replace: true,
          state: { expired, from: `${location.pathname}${location.search}${location.hash}` },
        });
    };
    const leavePatient = (expired) => {
      if (
        ["/", "/profile", "/settings"].includes(pathname) ||
        /^\/(health|history)(\/|$)/.test(pathname)
      )
        navigate("/login", { replace: true, state: { expired, from: `${location.pathname}${location.search}${location.hash}` } });
    };
    const expire = () => leaveAdmin(true),
      logout = () => leaveAdmin(false);
    const patientExpire = () => leavePatient(true),
      patientLogout = () => leavePatient(false);
    const requireChange = () =>
      navigate("/settings?required=1", { replace: true });
    const events = [
      ["carevigo:session-expired", expire],
      ["carevigo:logout", logout],
      ["carevigo:patient-expired", patientExpire],
      ["carevigo:patient-logout", patientLogout],
      ["carevigo:password-change-required", requireChange],
    ];
    events.forEach(([name, fn]) => window.addEventListener(name, fn));
    return () =>
      events.forEach(([name, fn]) => window.removeEventListener(name, fn));
  }, [location.pathname, location.search, location.hash, pathname, navigate]);
  return null;
}

function RequireStaff({ children }) {
  const location = useLocation();
  return hasAdminSession() ? (
    children
  ) : (
    <Navigate
      to="/admin/login"
      replace
      state={{
        from: `${location.pathname}${location.search}${location.hash}`,
        expired: getSessionSnapshot("admin").endedBy === "expired",
      }}
    />
  );
}
function RequirePatient({
  children,
  allowStaff = false,
  record = false,
  allowTemporary = false,
}) {
  const location = useLocation(),
    { citizenId } = useParams();
  const pathname = normalizePathname(location.pathname);
  const patientSession = hasPatientSession();
  const staff = allowStaff && !patientSession && hasAdminSession();
  const sessionId = getSessionSnapshot("patient").sessionId;
  const [verification, setVerification] = useState({
    sessionId: null,
    profile: null,
    error: "",
  });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (staff || !patientSession) return;
    let active = true;
    setVerification({ sessionId: null, profile: null, error: "" });
    getPatientProfile()
      .then((response) => {
        if (!active) return;
        const data = response.data?.data;
        if (!data?.patient) throw new Error("Invalid patient profile");
        const profile = storePatientProfile(
          data.patient,
          data.requiresPasswordChange,
        );
        setVerification({ sessionId, profile, error: "" });
      })
      .catch((error) => {
        if (active)
          setVerification({
            sessionId,
            profile: null,
            error: getApiError(error, "ตรวจสอบบัญชีไม่สำเร็จ กรุณาลองอีกครั้ง"),
          });
      });
    return () => {
      active = false;
    };
  }, [sessionId, patientSession, staff, retry]);
  if (staff) return children;
  if (!patientSession && record && pathname.startsWith("/health"))
    return <Navigate to="/guest" replace />;
  if (!patientSession)
    return (
      <Navigate
        to="/login"
        replace
        state={{ expired: getSessionSnapshot("patient").endedBy === "expired", from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  if (verification.sessionId !== sessionId)
    return <LoadingScreen title="กำลังตรวจสอบบัญชีของคุณ…" description="กำลังเตรียมข้อมูลสุขภาพส่วนตัวของคุณ" />;
  if (verification.error)
    return (
      <PublicLayout active="dashboard">
        <Notice tone="error">{verification.error}</Notice>
        <Button
          variant="secondary"
          onClick={() => setRetry((value) => value + 1)}
        >
          ลองอีกครั้ง
        </Button>
      </PublicLayout>
    );
  const profile = verification.profile || getStoredPatient();
  if (profile?.requiresPasswordChange && !allowTemporary)
    return <Navigate to="/settings?required=1" replace />;
  if (record && (!citizenId || citizenId !== profile?.citizenId))
    return (
      <Navigate
        to={`${pathname.startsWith("/history") ? "/history" : pathname.startsWith("/progress") ? "/progress" : "/health"}/${profile.citizenId}${location.search}${location.hash}`}
        replace
      />
    );
  return children;
}

function HomeEntry({ patientEpoch }) {
  // A session ending on this private page should retain its scoped login notice.
  // A later visit to the neutral entry must not inherit that earlier redirect.
  const hadPatientSession = useRef(hasPatientSession());
  if (hasPatientSession()) hadPatientSession.current = true;
  const destination = getLandingDestination({
    hasAdmin: hasAdminSession(), hasPatient: hasPatientSession(), patient: getStoredPatient(),
  });
  if (destination === "/admin") return <Navigate to={destination} replace />;
  if (hasPatientSession()) return <RequirePatient key={patientEpoch}><PatientDashboard /></RequirePatient>;
  if (hadPatientSession.current && getSessionSnapshot("patient").endedBy)
    return <Navigate to="/login" replace state={{ expired: getSessionSnapshot("patient").endedBy === "expired", from: "/" }} />;
  return <Navigate to={destination} replace />;
}

export default function App() {
  const [, setSessionEpoch] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeSessions(() => setSessionEpoch((epoch) => epoch + 1));
    initializeSessions().catch(() => {});
    return unsubscribe;
  }, []);
  const patientEpoch = getSessionSnapshot("patient").version;
  const adminEpoch = getSessionSnapshot("admin").version;
  return (
    <LoadingScreenProvider><BrowserRouter>
      <NavigationEffects />
      <ServerReadinessNotice />
      <LogoutNotice />
      <PasswordChangeNotice />
      <Routes>
        <Route
          path="/"
          element={
            <SessionBoundary scope={hasAdminSession() ? "admin" : ["admin", "patient"]}>
              <HomeEntry patientEpoch={patientEpoch} />
            </SessionBoundary>
          }
        />
        <Route path="/login" element={<SessionBoundary scope={hasAdminSession() ? "admin" : ["admin", "patient"]}><PatientLogin /></SessionBoundary>} />
        <Route path="/guest" element={<GuestHealth />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/review-email" element={<EmailReview />} />
        <Route
          path="/register"
          element={
            <SessionBoundary scope="admin"><RequireStaff key={adminEpoch}>
              <CreateUser />
            </RequireStaff></SessionBoundary>
          }
        />
        <Route
          path="/health"
          element={
            <SessionBoundary scope={["patient", "admin"]}><RequirePatient key={`${patientEpoch}:${adminEpoch}`} allowStaff record>
              <AddHealth />
            </RequirePatient></SessionBoundary>
          }
        />
        <Route
          path="/health/:citizenId"
          element={
            <SessionBoundary scope={["patient", "admin"]}><RequirePatient key={`${patientEpoch}:${adminEpoch}`} allowStaff record>
              <AddHealth />
            </RequirePatient></SessionBoundary>
          }
        />
        <Route
          path="/history"
          element={
            <SessionBoundary scope={["patient", "admin"]}><RequirePatient key={`${patientEpoch}:${adminEpoch}`} allowStaff record>
              <HealthHistory />
            </RequirePatient></SessionBoundary>
          }
        />
        <Route
          path="/history/:citizenId"
          element={
            <SessionBoundary scope={["patient", "admin"]}><RequirePatient key={`${patientEpoch}:${adminEpoch}`} allowStaff record>
              <HealthHistory />
            </RequirePatient></SessionBoundary>
          }
        />
        <Route
          path="/profile"
          element={
            <SessionBoundary scope="patient"><RequirePatient key={patientEpoch}>
              <Profile />
            </RequirePatient></SessionBoundary>
          }
        />
        {["/progress", "/progress/:citizenId"].map(path => <Route key={path} path={path} element={
          <SessionBoundary scope="patient"><RequirePatient key={patientEpoch} record><HealthProgress /></RequirePatient></SessionBoundary>
        } />)}
        {["/admin/progress", "/admin/progress/:citizenId"].map(path => <Route key={path} path={path} element={
          <SessionBoundary scope="admin"><RequireStaff key={adminEpoch}><HealthProgress staffMode /></RequireStaff></SessionBoundary>
        } />)}
        <Route
          path="/settings"
          element={
            <SessionBoundary scope="patient"><RequirePatient key={patientEpoch} allowTemporary>
              <PatientSettings />
            </RequirePatient></SessionBoundary>
          }
        />
        <Route path="/help" element={<Help />} />
        <Route
          path="/admin/login"
          element={<SessionBoundary scope="admin"><AdminLogin /></SessionBoundary>}
        />
        <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
        <Route path="/admin/reset-password" element={<AdminResetPassword />} />
        <Route
          path="/admin"
          element={
            <SessionBoundary scope="admin"><RequireStaff key={adminEpoch}>
              <AdminDashboard />
            </RequireStaff></SessionBoundary>
          }
        />
        <Route path="/coming-soon" element={<Navigate to="/help" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter></LoadingScreenProvider>
  );
}
