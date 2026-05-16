import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUser, saveSession } from "../auth/session";
import profileApi from "../api/profile";
import { resolveServerUrl } from "../api/urls";
import { Camera } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ProfileSetup() {
  const navigate = useNavigate();
  const user = getUser();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const { t, i18n } = useTranslation();



  const handleMouseDown = (e) => {
    if (!formData.profileImageUrl) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Form State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    language: "French",
    rank: "",
    subject: "",
    schoolLevel: "",
    delegationId: "", // For teachers
    dependencyId: "", // For teachers
    departmentId: "", 
    delegationIds: [], // For inspectors
    dependencyIds: [], // For inspectors
    departmentIds: [], // For inspectors
    etablissementId: "", // For teachers
    etablissementIds: [], // For inspectors
    profileImageUrl: "",
  });

  useEffect(() => {
    const langMap = {
      "French": "fr",
      "English": "en",
      "Arabic": "ar"
    };
    if (formData?.language && langMap[formData.language]) {
      i18n.changeLanguage(langMap[formData.language]);
    }
  }, [formData?.language, i18n]);

  // Reference Data State
  const [ranks, setRanks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [levels, setLevels] = useState([]);
  const [delegations, setDelegations] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [etablissements, setEtablissements] = useState([]);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    // Load initial reference data
    async function loadInitialData() {
      try {
        const [ranksRes, subjectsRes, levelsRes, delegationsRes] = await Promise.all([
          profileApi.getRanks(),
          profileApi.getSubjects(),
          profileApi.getSchoolLevels(),
          profileApi.getDelegations(),
        ]);
        setRanks(ranksRes.data.data);
        setSubjects(subjectsRes.data.data);
        setLevels(levelsRes.data.data);
        setDelegations(delegationsRes.data.data);
      } catch (err) {
        setError("Failed to load reference data.");
      }
    }

    async function loadExistingProfile() {
      if (user.profileCompleted) {
        try {
          const res = user.role === "INSPECTOR" 
            ? await profileApi.getInspectorProfile() 
            : await profileApi.getTeacherProfile();
          
          const p = res.data.data;
          setFormData({
            firstName: p.firstName,
            lastName: p.lastName,
            phone: p.phone || "",
            language: p.language || "French",
            rank: p.rank || "",
            subject: p.subject || "",
            schoolLevel: p.schoolLevel || "",
            delegationId: p.delegation?.id || "",
            dependencyId: p.dependency?.id || "",
            departmentId: p.department?.id || "",
            delegationIds: p.delegations?.map(d => d.id) || [],
            dependencyIds: p.dependencies?.map(d => d.id) || [],
            departmentIds: p.departments?.map(d => d.id) || [],
            etablissementId: p.etablissement?.id || "",
            etablissementIds: p.etablissements?.map(e => e.id) || [],
            profileImageUrl: user.profileImageUrl || "",
          });
        } catch (err) {
          console.error("Error loading profile:", err);
        }
      }
    }

    loadInitialData();
    loadExistingProfile();
  }, [user?.id, user?.profileCompleted, navigate]);

  // Load Dependencies/Departments when Delegation changes
  useEffect(() => {
    const ids = user?.role === "INSPECTOR" ? formData.delegationIds : [formData.delegationId].filter(Boolean);
    if (ids.length > 0) {
      async function loadRegionalData() {
        try {
          const deps = await Promise.all(ids.map(id => profileApi.getDependencies(id)));
          const depts = await Promise.all(ids.map(id => profileApi.getDepartments(id)));
          
          const allDeps = deps.flatMap(res => res.data.data);
          const allDepts = depts.flatMap(res => res.data.data);
          
          // Deduplicate
          const uniqueDeps = Array.from(new Map(allDeps.map(item => [item.id, item])).values());
          const uniqueDepts = Array.from(new Map(allDepts.map(item => [item.id, item])).values());
          
          setDependencies(uniqueDeps);
          setDepartments(uniqueDepts);
        } catch (err) {
          setError("Failed to load regional data.");
        }
      }
      loadRegionalData();
    }
  }, [formData.delegationId, formData.delegationIds.length, user?.role]);

  useEffect(() => {
    if (user?.role !== "INSPECTOR") return;

    const validDependencyIds = new Set(dependencies.map(d => d.id));
    const validDepartmentIds = new Set(departments.map(d => d.id));

    setFormData(prev => {
      const dependencyIds = prev.dependencyIds.filter(id => validDependencyIds.has(id));
      const departmentIds = prev.departmentIds.filter(id => validDepartmentIds.has(id));

      if (dependencyIds.length === prev.dependencyIds.length && departmentIds.length === prev.departmentIds.length) {
        return prev;
      }

      return { ...prev, dependencyIds, departmentIds };
    });
  }, [dependencies, departments, user?.role]);

  // Load Etablissements when Dependency or Level changes
  useEffect(() => {
    const ids = user?.role === "INSPECTOR" ? formData.dependencyIds : [formData.dependencyId].filter(Boolean);
    if (ids.length > 0) {
      async function loadEtablissements() {
        try {
          const resArr = await Promise.all(ids.map(id => 
            profileApi.getEtablissements(id, user.role === "INSPECTOR" ? formData.schoolLevel : "")
          ));
          
          const allEtabs = resArr.flatMap(res => res.data.data);
          const uniqueEtabs = Array.from(new Map(allEtabs.map(item => [item.id, item])).values());
          
          setEtablissements(uniqueEtabs);
        } catch (err) {
          setError("Failed to load institutions.");
        }
      }
      loadEtablissements();
    }
  }, [formData.dependencyId, formData.dependencyIds.length, formData.schoolLevel, user?.role]);

  useEffect(() => {
    const validEtablissementIds = new Set(etablissements.map(e => e.id));

    setFormData(prev => {
      if (user?.role === "INSPECTOR") {
        const etablissementIds = prev.etablissementIds.filter(id => validEtablissementIds.has(id));
        return etablissementIds.length === prev.etablissementIds.length ? prev : { ...prev, etablissementIds };
      }

      if (prev.etablissementId && !validEtablissementIds.has(Number(prev.etablissementId))) {
        return { ...prev, etablissementId: "" };
      }

      return prev;
    });
  }, [etablissements, user?.role]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (name === "delegationId") {
        return { ...prev, delegationId: value, dependencyId: "", etablissementId: "" };
      }

      if (name === "dependencyId") {
        return { ...prev, dependencyId: value, etablissementId: "" };
      }

      if (name === "schoolLevel") {
        return { ...prev, schoolLevel: value, etablissementIds: [] };
      }

      return { ...prev, [name]: value };
    });
  };

  const handleMultiSelect = (field, id) => {
    setFormData((prev) => {
      const exists = prev[field].includes(id);
      const nextValue = exists ? prev[field].filter((item) => item !== id) : [...prev[field], id];

      if (field === "delegationIds") {
        return {
          ...prev,
          delegationIds: nextValue,
          dependencyIds: [],
          departmentIds: [],
          etablissementIds: [],
        };
      }

      if (field === "dependencyIds") {
        return {
          ...prev,
          dependencyIds: nextValue,
          etablissementIds: [],
        };
      }

      if (exists) {
        return { ...prev, [field]: prev[field].filter((item) => item !== id) };
      } else {
        return { ...prev, [field]: [...prev[field], id] };
      }
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("Image size must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, profileImageUrl: reader.result }));
        setPosition({ x: 0, y: 0 });
        setZoom(1);
      };
      reader.readAsDataURL(file);
    }
  };

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  const handleCropAndProceed = () => {
    if (!formData.profileImageUrl) return;
    
    const getAvatarUrl = (url) => {
      if (!url || url === "null") return null;
      return resolveServerUrl(url);
    };

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = getAvatarUrl(formData.profileImageUrl);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const cropSize = 300; // Final saved size
      canvas.width = cropSize;
      canvas.height = cropSize;
      const ctx = canvas.getContext('2d');

      // The hole is 190px in a 280px container.
      // Ratio of hole to container = 190 / 280
      const holeToContainerRatio = 190 / 280;
      
      // We want to capture what's inside the 190px circle.
      // In the UI, the image is scaled by 'zoom' and moved by 'position'.
      
      // Map the UI coordinates to the actual image coordinates
      const displayWidth = 280; // The container width in UI
      const displayHeight = 280;
      
      // The actual displayed size of the image in the UI:
      // (Since object-fit: contain is used, we need to know the base size)
      // For simplicity, let's assume the image filled the 280x280 box as a base.
      
      const renderWidth = displayWidth * zoom;
      const renderHeight = displayHeight * zoom;
      
      // Center of the container
      const centerX = displayWidth / 2;
      const centerY = displayHeight / 2;
      
      // The top-left of the image relative to the container center
      const imgX = centerX + position.x - (renderWidth / 2);
      const imgY = centerY + position.y - (renderHeight / 2);
      
      // The hole's top-left relative to the container
      const holeX = (displayWidth - 190) / 2;
      const holeY = (displayHeight - 190) / 2;
      
      // Difference (hole relative to image)
      const diffX = holeX - imgX;
      const diffY = holeY - imgY;
      
      // Convert UI diff to Source Image coordinates
      const scaleX = img.width / renderWidth;
      const scaleY = img.height / renderHeight;
      
      const sX = diffX * scaleX;
      const sY = diffY * scaleY;
      const sW = 190 * scaleX;
      const sH = 190 * scaleY;

      ctx.drawImage(img, sX, sY, sW, sH, 0, 0, cropSize, cropSize);
      
      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
      setFormData(prev => ({ ...prev, profileImageUrl: croppedBase64 }));
      
      // Reset zoom/pos for the next preview (which will now be the cropped image)
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      
      if (isStep1Valid) {
        nextStep();
      } else {
        setError("Please fill in your name and phone number below.");
      }
    };
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let res;
      if (user.role === "INSPECTOR") {
        res = user.profileCompleted 
          ? await profileApi.updateInspectorProfile(formData)
          : await profileApi.completeInspectorProfile(formData);
      } else {
        res = user.profileCompleted
          ? await profileApi.updateTeacherProfile(formData)
          : await profileApi.completeTeacherProfile(formData);
      }

      setSuccess("Profile saved successfully! Redirecting...");
      
      // Update local storage user state
      const updatedUser = { ...user, profileCompleted: true, profileImageUrl: formData.profileImageUrl };
      localStorage.setItem("user", JSON.stringify(updatedUser));

      setTimeout(() => {
        navigate(user.role === "INSPECTOR" ? "/inspector" : "/teacher");
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to complete profile.");
    } finally {
      setLoading(false);
    }
  };

  const isStep1Valid = formData.firstName && formData.lastName && formData.phone;
  const isStep2Valid = user.role === "INSPECTOR" 
    ? (formData.rank && formData.subject && formData.schoolLevel && formData.delegationIds.length > 0 && formData.dependencyIds.length > 0 && formData.departmentIds.length > 0)
    : (formData.subject && formData.delegationId && formData.dependencyId && formData.etablissementId);
  const isStep3Valid = user.role === "INSPECTOR" ? formData.etablissementIds.length > 0 : true;

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: "600px" }}>
        <header style={{ marginBottom: "2.5rem", textAlign: "center" }}>
          <h1 className="step-title-gradient">
            {step === 1 ? t("personalProfile") : step === 2 ? t("professionalContext") : t("jurisdictionArea")}
          </h1>
          <p className="muted" style={{ fontWeight: 600 }}>{t("initialSetup")}</p>
          
          <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginTop: "1.5rem" }}>
            {[1, 2, user.role === "INSPECTOR" ? 3 : null].filter(Boolean).map((s) => (
              <div 
                key={s} 
                className={`step-dot ${step >= s ? "active" : ""}`}
                style={{ 
                  width: "12px", 
                  height: "12px", 
                  borderRadius: "50%", 
                  background: step >= s ? "var(--primary)" : "#cbd5e1",
                  transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                }}
              />
            ))}
          </div>
        </header>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={(e) => e.preventDefault()} className="auth-form">
          {step === 1 && (
            <div className="wizard-step">
              <h3 style={{ marginBottom: "1.5rem", textAlign: "center" }}>{t("step1")}</h3>
              
              <div className="profile-editor-container">
                <div className="editor-mask-wrapper">
                  {formData.profileImageUrl ? (
                    <>
                      <div 
                        className="editor-preview-bg"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                      >
                        <img 
                          src={resolveServerUrl(formData.profileImageUrl)}
                          alt="Adjust" 
                          crossOrigin="anonymous"
                          draggable={false}
                          style={{ 
                            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                          }}
                        />
                      </div>
                      <div className="editor-hole"></div>
                      
                      <div className="editor-controls-pill">
                        <button type="button" onClick={() => setZoom(Math.max(1, zoom - 0.1))}>−</button>
                        <button type="button" onClick={() => setZoom(Math.min(3, zoom + 0.1))}>+</button>
                        <div className="v-divider"></div>
                        <button type="button" className="reset-btn" onClick={() => { setZoom(1); setPosition({x:0, y:0}); }}>{t("reset")}</button>
                        <div className="v-divider"></div>
                        <label style={{ cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center' }}>
                          <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                          <span className="reset-btn" style={{ color: "var(--primary)" }}>Change</span>
                        </label>
                      </div>
                    </>
                  ) : (
                    <div className="editor-placeholder">
                      <div className="placeholder-circle">
                        <span>{formData.firstName?.[0] || user?.email?.[0]?.toUpperCase()}</span>
                      </div>
                      <label className="upload-trigger-btn">
                        <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                        <Camera size={18} />
                        <span>{t("uploadPhoto")}</span>
                      </label>
                    </div>
                  )}
                </div>
                {formData.profileImageUrl && (
                  <button 
                    type="button" 
                    className="confirm-pic-btn" 
                    onClick={handleCropAndProceed}
                  >
                    {t("confirmSelection")}
                  </button>
                )}
                <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem", textAlign: 'center' }}>
                  {formData.profileImageUrl ? t("positionZoom") : t("selectPhoto")}
                </p>
              </div>

              <div className="form-row">
                <label>
                  {t("firstName")}
                  <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required />
                </label>
                <label>
                  {t("lastName")}
                  <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required />
                </label>
              </div>
              <label style={{ marginTop: "1rem" }}>
                {t("phoneNumber")}
                <input type="text" name="phone" dir="ltr" style={{ textAlign: i18n.dir() === 'rtl' ? 'right' : 'left' }} value={formData.phone} onChange={handleChange} placeholder="+216 ..." required />
              </label>
              <label style={{ marginTop: "1rem" }}>
                {t("internalCommLanguage")}
                <select name="language" value={formData.language} onChange={handleChange}>
                  <option value="French">Français</option>
                  <option value="Arabic">العربية</option>
                  <option value="English">English</option>
                </select>
              </label>

              <div className="form-actions" style={{ marginTop: "2rem" }}>

                <button type="button" onClick={nextStep} disabled={!isStep1Valid} style={{ width: "100%" }}>
                  {t("nextDetails")}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-step">
              <h3 style={{ marginBottom: "1rem" }}>Step 2: Professional Context</h3>
              
              {user.role === "INSPECTOR" && (
                <div className="form-row">
                  <label>
                    Professional Rank
                    <select name="rank" value={formData.rank} onChange={handleChange} required>
                      <option value="">Select Rank</option>
                      {ranks.map(r => <option key={r.name} value={r.name}>{r.label}</option>)}
                    </select>
                  </label>
                  <label>
                    Primary School Level
                    <select name="schoolLevel" value={formData.schoolLevel} onChange={handleChange} required>
                      <option value="">Select Level</option>
                      {levels.map(l => <option key={l.name} value={l.name}>{l.label}</option>)}
                    </select>
                  </label>
                </div>
              )}

              <label style={{ marginTop: "1rem" }}>
                Teaching Subject
                <select name="subject" value={formData.subject} onChange={handleChange} required>
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.name} value={s.name}>{s.label}</option>)}
                </select>
              </label>

              <div style={{ marginTop: "1rem" }}>
                <label style={{ marginBottom: "0.5rem", display: "block" }}>Delegations</label>
                {user.role === "INSPECTOR" ? (
                  <div className="multi-select-grid">
                    {delegations.map(d => (
                      <div 
                        key={d.id} 
                        className={`chip ${formData.delegationIds.includes(d.id) ? "active" : ""}`}
                        onClick={() => handleMultiSelect("delegationIds", d.id)}
                      >
                        {d.name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <select name="delegationId" value={formData.delegationId} onChange={handleChange} required>
                    <option value="">Select</option>
                    {delegations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                )}
              </div>

              <div style={{ marginTop: "1rem" }}>
                <label style={{ marginBottom: "0.5rem", display: "block" }}>Regional Dependencies</label>
                {user.role === "INSPECTOR" ? (
                  <div className="multi-select-grid">
                    {dependencies.map(d => (
                      <div 
                        key={d.id} 
                        className={`chip ${formData.dependencyIds.includes(d.id) ? "active" : ""}`}
                        onClick={() => handleMultiSelect("dependencyIds", d.id)}
                      >
                        {d.name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <select name="dependencyId" value={formData.dependencyId} onChange={handleChange} disabled={!formData.delegationId} required>
                    <option value="">Select</option>
                    {dependencies.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                )}
              </div>

              <div style={{ marginTop: "1rem" }}>
                <label style={{ marginBottom: "0.5rem", display: "block" }}>
                  {user.role === "INSPECTOR" ? "Assigned Departments" : "Primary School (Teacher Assignment)"}
                </label>
                {user.role === "INSPECTOR" ? (
                  <div className="multi-select-grid">
                    {departments.map(d => (
                      <div 
                        key={d.id} 
                        className={`chip ${formData.departmentIds.includes(d.id) ? "active" : ""}`}
                        onClick={() => handleMultiSelect("departmentIds", d.id)}
                      >
                        {d.name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <select name="etablissementId" value={formData.etablissementId} onChange={handleChange} disabled={!formData.dependencyId} required>
                    <option value="">Select School</option>
                    {etablissements.map(e => <option key={e.id} value={e.id}>{e.name} ({e.schoolLevel})</option>)}
                  </select>
                )}
              </div>

              <div className="form-actions" style={{ marginTop: "2rem" }}>
                <button type="button" className="secondary-action-btn" onClick={prevStep}>Back</button>
                {user.role === "INSPECTOR" ? (
                  <button type="button" onClick={nextStep} disabled={!isStep2Valid} style={{ flex: 1 }}>Manage Assignments</button>
                ) : (
                  <button type="button" onClick={handleSubmit} disabled={!isStep2Valid || loading} style={{ flex: 1 }}>
                    {loading ? "Finalizing..." : "Complete Setup"}
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 3 && user.role === "INSPECTOR" && (
            <div className="wizard-step">
              <h3 style={{ marginBottom: "0.5rem" }}>Step 3: School Jurisdictions</h3>
              <p className="muted" style={{ marginBottom: "1.5rem" }}>Select the schools you are responsible for monitoring.</p>
              
              <div style={{ maxHeight: "300px", overflowY: "auto", display: "grid", gap: "0.5rem", padding: "0.5rem", border: "1px solid var(--border-subtle)", borderRadius: "12px" }}>
                {etablissements.length === 0 ? (
                  <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>Select a dependency in step 2 to see schools.</p>
                ) : (
                  etablissements.map(e => (
                    <div 
                      key={e.id} 
                      onClick={() => handleMultiSelect("etablissementIds", e.id)}
                      style={{ 
                        padding: "0.75rem 1rem", 
                        borderRadius: "10px", 
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor: formData.etablissementIds.includes(e.id) ? "var(--primary)" : "transparent",
                        background: formData.etablissementIds.includes(e.id) ? "var(--primary-soft)" : "#f8fafc",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "all 0.2s"
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{e.name}</div>
                        <small style={{ color: "var(--text-muted)" }}>{e.schoolLevel}</small>
                      </div>
                      {formData.etablissementIds.includes(e.id) && <span style={{ color: "var(--primary)", fontWeight: 800 }}>✓</span>}
                    </div>
                  ))
                )}
              </div>

              <div className="form-actions" style={{ marginTop: "2rem" }}>
                <button type="button" className="secondary-action-btn" onClick={prevStep}>Back</button>
                <button type="button" onClick={handleSubmit} disabled={!isStep3Valid || loading} style={{ flex: 1 }}>
                  {loading ? "Finalizing..." : "Complete Setup"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .auth-page {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 100%);
          min-height: 100vh;
          padding: 3rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .auth-card {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 32px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08);
          padding: 3rem;
          width: 100%;
        }
        .step-title-gradient {
          font-size: 1.75rem;
          font-weight: 900;
          background: linear-gradient(to right, #1e293b, #4f46e5);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 0.5rem;
        }
        .profile-editor-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 2rem 0;
          padding: 1.5rem;
          background: rgba(255, 255, 255, 0.4);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.6);
        }
        .editor-mask-wrapper {
          position: relative;
          width: 280px;
          height: 280px;
          background: #ffffff;
          border-radius: 20px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px rgba(0,0,0,0.05);
        }
        .editor-preview-bg {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .editor-preview-bg img {
          max-width: none;
          height: 100%;
          object-fit: contain;
          transition: transform 0.1s ease-out;
        }
        .editor-hole {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
          box-shadow: 0 0 0 999px rgba(255, 255, 255, 0.88);
          border: 3px solid #ffffff;
          border-radius: 50%;
          width: 190px;
          height: 190px;
          margin: auto;
          box-shadow: 0 0 0 999px rgba(255, 255, 255, 0.88), inset 0 0 15px rgba(0,0,0,0.05);
        }
        .editor-controls-pill {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          padding: 8px 16px;
          border-radius: 100px;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 12px 30px rgba(0,0,0,0.12);
          z-index: 20;
          border: 1px solid rgba(255, 255, 255, 1);
        }
        .editor-controls-pill button {
          background: transparent;
          border: none;
          color: #1e293b;
          font-size: 1.4rem;
          font-weight: 800;
          padding: 0 5px;
          box-shadow: none;
          width: auto;
          height: auto;
          transition: all 0.2s;
        }
        .editor-controls-pill button:hover {
          color: var(--primary);
          transform: scale(1.2);
        }
        .v-divider {
          width: 1.5px;
          height: 24px;
          background: #e2e8f0;
        }
        .reset-btn {
          font-size: 0.85rem !important;
          color: #64748b !important;
          font-weight: 700 !important;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .editor-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }
        .placeholder-circle {
          width: 140px;
          height: 140px;
          background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3.5rem;
          font-weight: 900;
          color: #94a3b8;
          border: 4px dashed #cbd5e1;
        }
        .upload-trigger-btn {
          background: linear-gradient(135deg, var(--primary), #4338ca);
          color: white !important;
          padding: 12px 24px;
          border-radius: 14px;
          font-weight: 800;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2);
          display: flex;
          align-items: center;
          gap: 10px;
          border: none;
        }
        .upload-trigger-btn span {
          color: white !important;
        }
        .upload-trigger-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 15px 25px rgba(79, 70, 229, 0.3);
          color: white !important;
        }
        .confirm-pic-btn {
          width: 100%;
          margin-top: 1.5rem;
          background: linear-gradient(135deg, var(--primary), #4338ca);
          color: white !important;
          padding: 16px;
          border-radius: 16px;
          font-weight: 800;
          font-size: 1rem;
          border: none;
          box-shadow: 0 12px 25px rgba(79, 70, 229, 0.25);
          transition: all 0.3s;
          text-transform: uppercase;
          letter-spacing: 1px;
          cursor: pointer;
        }
        .confirm-pic-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px rgba(79, 70, 229, 0.35);
        }
        .step-dot.active {
          transform: scale(1.3);
          box-shadow: 0 0 15px rgba(79, 70, 229, 0.3);
          background: var(--primary) !important;
        }
        .auth-form label {
          font-size: 0.85rem;
          font-weight: 700;
          color: #475569;
          margin-bottom: 0.5rem;
          display: block;
        }
        .auth-form input, .auth-form select {
          border-radius: 14px;
          padding: 0.85rem 1.1rem;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          transition: all 0.2s;
        }
        .auth-form input:focus, .auth-form select:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
        }
        .secondary-action-btn {
          border-radius: 14px;
          padding: 0.85rem 1.5rem;
          background: #f1f5f9;
          color: #475569;
          font-weight: 700;
          border: none;
          transition: all 0.2s;
        }
        .secondary-action-btn:hover {
          background: #e2e8f0;
          color: #1e293b;
        }
        button[type="button"]:not(.secondary-action-btn):not(.confirm-pic-btn):not(.editor-controls-pill button) {
          border-radius: 14px;
          background: linear-gradient(135deg, var(--primary), #4338ca);
          font-weight: 800;
          box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2);
        }
      `}} />
    </div>
  );
}
