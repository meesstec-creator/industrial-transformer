import { useState, useRef } from "react";
import styles from "./App.module.css";

const STYLES = [
  { id: "modern-industrieel", name: "Modern Industrieel", prompt: "modern industrial architecture with steel, glass and concrete, green accents, rooftop garden" },
  { id: "duurzaam-groen", name: "Duurzaam & Groen", prompt: "sustainable green architecture with living walls, solar panels, natural materials, biophilic design" },
  { id: "mixed-use", name: "Mixed-Use Complex", prompt: "mixed-use development with retail ground floor, offices and residential units, vibrant street life" },
  { id: "tech-hub", name: "Tech Hub", prompt: "innovative tech office building with smart building features, LED facades, modern minimalist design" },
  { id: "logistiek-modern", name: "Moderne Logistiek", prompt: "modern logistics center with efficient design, solar roof, green loading docks, sustainable warehouse" },
];

const BUILDING_TYPES = [
  { id: "warehouse", name: "Loods / Warehouse", prompt: "industrial warehouse building" },
  { id: "office", name: "Kantoorpand", prompt: "office building" },
  { id: "retail", name: "Winkel / Retail", prompt: "retail commercial building" },
  { id: "factory", name: "Fabriek", prompt: "factory industrial building" },
  { id: "garage", name: "Garage / Werkplaats", prompt: "garage workshop building" },
];

function App() {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState("modern-industrieel");
  const [buildingType, setBuildingType] = useState("warehouse");
  const [transformMode, setTransformMode] = useState("renovatie");
  const [usedPrompt, setUsedPrompt] = useState(null);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("pollinations-api-key") || "sk_MGCJnAI2YG9Zz9Cqh5wC1UPEIBHUKPZH");
  const fileInputRef = useRef(null);

  function handleApiKeyChange(key) {
    setApiKey(key);
    localStorage.setItem("pollinations-api-key", key);
  }

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
      setGeneratedImage(null);
      setUsedPrompt(null);
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => setUploadedImage(event.target.result);
      reader.readAsDataURL(file);
    }
  }

  async function generateVisualization() {
    setIsGenerating(true);
    setError(null);

    const styleInfo = STYLES.find((s) => s.id === selectedStyle);
    const buildingInfo = BUILDING_TYPES.find((b) => b.id === buildingType);

    let prompt;

    if (uploadedImage && transformMode === "renovatie") {
      prompt = `You are an expert in real estate development and architecture. Edit this photo of a ${buildingInfo.prompt} and create a realistic redevelopment in the style: ${styleInfo.name} (${styleInfo.prompt}).

IMPORTANT GUIDELINES:
- KEEP the EXISTING scale, footprint and basic structure of the building
- This must be a TRANSFORMATION, not an entirely new building
- Keep the visible surroundings and context: same perspective, same camera angle, same cars, same road, same sky
- Be realistic about what is achievable with this specific building
- Only modernize the building facade and add green urban landscaping (trees, grass, hedges) to the public space
- The result must describe the ORIGINAL building with improvements, not a fantasy building
- Photorealistic architectural photography edit`;
    } else if (uploadedImage && transformMode === "volledig") {
      prompt = `You are an expert in real estate development and architecture. Edit this photo: replace the ${buildingInfo.prompt} with a completely new building in the style: ${styleInfo.name} (${styleInfo.prompt}).

IMPORTANT GUIDELINES:
- The new building must fit on the EXACT SAME plot/parcel as the current building. Do NOT make it wider or take space from neighboring properties
- Keep the EXACT same perspective, camera angle, and viewpoint
- Keep ALL surroundings exactly the same: same cars on the road, same street, same sky, same neighboring buildings, same trees that are not on the plot
- Only replace the building itself and add green urban landscaping (trees, grass, hedges) to the public space directly around it
- The new building should be a realistic, buildable design - not a fantasy
- Photorealistic architectural photography, same lighting conditions as original photo`;
    } else {
      prompt = `Architectural photography of a renovated ${buildingInfo.prompt} transformed into ${styleInfo.prompt}. The building maintains its original footprint and scale but features a completely modernized exterior. This is a realistic transformation, not a fantasy building. Keep the surroundings urban and contextual. Add green public space with trees, grass and hedges around the building. Professional architectural visualization, golden hour lighting, photorealistic, street-level perspective, high-end real estate photography style`;
    }

    try {
      let refImageUrl = "";
      if (uploadedImage && imageFile) {
        const uploadForm = new FormData();
        uploadForm.append("file", imageFile);
        const uploadRes = await fetch("https://tmpfiles.org/api/v1/upload", {
          method: "POST",
          body: uploadForm,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          // tmpfiles.org returns url like https://tmpfiles.org/123/file.jpg
          // direct link is https://tmpfiles.org/dl/123/file.jpg
          refImageUrl = uploadData.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
        }
      }

      const encodedPrompt = encodeURIComponent(prompt);
      const seed = Math.floor(Math.random() * 2147483647);
      let imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?width=1024&height=768&nologo=true&seed=${seed}&model=nanobanana-pro&key=${encodeURIComponent(apiKey)}`;

      if (refImageUrl) {
        imageUrl += `&image=${encodeURIComponent(refImageUrl)}`;
      }

      const MODELS = ["nanobanana-pro", "nanobanana", "gptimage"];
      let response;
      let lastError = "";

      for (const model of MODELS) {
        const url = imageUrl.replace("model=nanobanana-pro", `model=${model}`);
        response = await fetch(url);

        if (response.ok) break;

        const text = await response.text().catch(() => "");
        try {
          const json = JSON.parse(text);
          lastError = json.error?.message || json.message || text;
        } catch { lastError = text; }

        // Retry with next model on 429 or 5xx
        if (response.status === 429 || response.status >= 500) {
          continue;
        }
        throw new Error(lastError || `Fout ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(lastError || "Alle modellen zijn overbelast. Probeer het later opnieuw.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      setGeneratedImage(objectUrl);
      setUsedPrompt(prompt);
    } catch (err) {
      console.error("Error:", err);
      setError(err.message || "Er ging iets mis. Probeer opnieuw.");
    } finally {
      setIsGenerating(false);
    }
  }

  const currentBuilding = BUILDING_TYPES.find((b) => b.id === buildingType);
  const currentStyle = STYLES.find((s) => s.id === selectedStyle);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>Herontwikkel je Pand</h1>
        <p className={styles.subtitle}>
          Visualiseer hoe jouw bedrijfspand getransformeerd kan worden
        </p>
      </header>

      <div className={`${styles.container} ${generatedImage ? styles.twoCols : ""}`}>
        <div className={styles.panel}>
          <div className={styles.section}>
            <label className={styles.label}>API Key</label>
            <input
              className={styles.apiKeyInput}
              type="password"
              placeholder="sk_..."
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
            />
            <p className={styles.apiKeyHint}>
              Haal je key op bij{" "}
              <a href="https://enter.pollinations.ai" target="_blank" rel="noreferrer">
                enter.pollinations.ai
              </a>
            </p>
          </div>

          <div className={styles.section}>
            <label className={styles.label}>1. Upload foto (optioneel, ter referentie)</label>
            <div className={styles.upload} onClick={() => fileInputRef.current?.click()}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                hidden
              />
              {uploadedImage ? (
                <img src={uploadedImage} alt="Upload" className={styles.uploadedImg} />
              ) : (
                <div className={styles.placeholder}>Klik om foto te uploaden</div>
              )}
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.label}>2. Type pand</label>
            <div className={styles.cardList}>
              {BUILDING_TYPES.map((b) => (
                <div
                  key={b.id}
                  className={`${styles.styleCard} ${buildingType === b.id ? styles.active : ""}`}
                  onClick={() => setBuildingType(b.id)}
                >
                  {b.name}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.label}>3. Gewenste stijl</label>
            <div className={styles.cardList}>
              {STYLES.map((s) => (
                <div
                  key={s.id}
                  className={`${styles.styleCard} ${selectedStyle === s.id ? styles.active : ""}`}
                  onClick={() => setSelectedStyle(s.id)}
                >
                  {s.name}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.label}>4. Transformatie modus</label>
            <div className={styles.cardList}>
              <div
                className={`${styles.styleCard} ${transformMode === "renovatie" ? styles.active : ""}`}
                onClick={() => setTransformMode("renovatie")}
              >
                Renovatie
                <span className={styles.cardDesc}>Gevel aanpassen, structuur behouden</span>
              </div>
              <div
                className={`${styles.styleCard} ${transformMode === "volledig" ? styles.active : ""}`}
                onClick={() => setTransformMode("volledig")}
              >
                Volledige herontwikkeling
                <span className={styles.cardDesc}>Nieuw gebouw, zelfde perceel en omgeving</span>
              </div>
            </div>
          </div>

          <button
            className={styles.generateBtn}
            onClick={generateVisualization}
            disabled={isGenerating}
          >
            {isGenerating ? "Genereren... (10-30 sec)" : "Genereer Visualisatie"}
          </button>

          {error && <p className={styles.error}>{error}</p>}
        </div>

        {generatedImage && (
          <div className={`${styles.panel} ${styles.results}`}>
            <h2 className={styles.resultsTitle}>Jouw Herontwikkeling</h2>
            <p className={styles.resultsSummary}>
              <strong>{currentBuilding?.name}</strong> &rarr;{" "}
              <strong>{currentStyle?.name}</strong>{" "}
              ({transformMode === "renovatie" ? "Renovatie" : "Volledige herontwikkeling"})
            </p>

            {usedPrompt && (
              <div className={styles.promptBox}>
                <h3 className={styles.promptTitle}>Gebruikte prompt</h3>
                <p className={styles.promptText}>{usedPrompt}</p>
              </div>
            )}

            <div className={styles.visualization}>
              <img src={generatedImage} alt="Visualisatie" className={styles.resultImg} />
              <div className={styles.buttonRow}>
                <a
                  href={generatedImage}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.btnSecondary}
                >
                  Download
                </a>
                <button
                  className={styles.btnSecondary}
                  onClick={generateVisualization}
                  disabled={isGenerating}
                >
                  Nieuwe variant
                </button>
              </div>
            </div>

            {uploadedImage && (
              <div className={styles.comparison}>
                <h3 className={styles.comparisonTitle}>Vergelijking</h3>
                <div className={styles.compareGrid}>
                  <div className={styles.compareCard}>
                    <span className={styles.compareLabel}>Huidig</span>
                    <img src={uploadedImage} alt="Huidig" />
                  </div>
                  <div className={styles.compareCard}>
                    <span className={styles.compareLabel}>Nieuw</span>
                    <img src={generatedImage} alt="Nieuw" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className={styles.footer}>
        <p>Gratis tool powered by Pollinations.ai - Visualisaties zijn indicatief</p>
      </footer>
    </div>
  );
}

export default App;
