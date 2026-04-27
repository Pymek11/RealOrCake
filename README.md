# DeepSzpont: A Study on AI Video Perceptibility

**A research project investigating the human ability to distinguish between authentic and AI-generated video content.**

## Project Scope

* **Objective:** Our primary goal was to examine human perception of reality and determine whether the boundary between generated videos and authentic footage has blurred to the point of indistinguishability compared to previous years.
* **Iterative Design:** Throughout the development process, both the video dataset and the User Interface (UI) underwent multiple iterations to ensure optimal testing conditions.
* **Standards:** We adhered to **ITU-R BT.500** guidelines for UI design and incorporated peer feedback to curate the video samples.

## Project Components

The project consists of three main components developed to facilitate the study:

1.  **Curated Video Dataset**: A collection of **27 video samples**, comprising 13 authentic clips sourced from Pixabay, 13 AI-generated sequences using various generative models, and 1 control sample (obvious AI generation).
2.  **Preprocessing Tool**: A custom Python-based script designed to crop footage and remove watermarks, ensuring visual consistency across all samples.
3.  **Web Assessment Platform**: A dedicated web application allowing study participants to view and evaluate the video samples seamlessly.

## Models Used

### Local Inference (Hardware: NVIDIA RTX 4090 24GB VRAM, 64GB RAM)
*Software environment: ComfyUI with models hosted locally (sourced from Hugging Face).*
* **Wan 2.2** (14B)
* **HunyuanVideo** (720p_fp8 with e4m3fn computing)

### Cloud/Online Models
* **Kling** (O1 and 2.5)
* **MinMax Hailuo** (2.3)
* **Sora** (v2 / v2 Pro)
* **Seadance** (1.0 Pro)

## System Requirements (Web App)

* **Node.js** (v18+ recommended)
* **npm** (included with Node)
* **MySQL Database**
* **Modern Browser** supporting ES6 modules (Chrome, Firefox, Edge)

## Technical Implementation & Workflows

Below are technical details regarding our local generation pipeline, running on an NVIDIA RTX 4090.

<details>
  <summary><b> 1. WAN 2.2 Generation Workflow (ComfyUI)</b></summary>
  <br>
  The screenshot below shows our primary ComfyUI setup for WAN 2.2 t2v. It highlights the dual approach we tested: the standard generation path and the optimized 4-step LoRA version for faster inference.
  <br><br>
  <div align="center">
    <img width="100%" alt="WAN 2.2 ComfyUI Workflow" src="https://github.com/user-attachments/assets/b78a7d1c-2e69-4ff8-a2eb-00b716d85e56" />
    <p><i>Figure: Overview of the WAN 2.2 text-to-video workflow nodes.</i></p>
  </div>
</details>

<details>
  <summary><b> 2. Example Prompt & Generation Process</b></summary>
  <br>
  To achieve photorealistic results, we utilized detailed prompts focusing on lighting, texture, and camera angles.
  <br><br>
  <div align="center">
    <img width="100%" alt="Example Prompt Node" src="https://github.com/user-attachments/assets/25abb66b-6b2c-4ebc-bfdc-fc58b728f129" />
  </div>

  <br>
  The images below demonstrate the backend process during generation: the model loading and processing steps in the Command Line Interface (CLI) and the corresponding VRAM utilization on the RTX 4090.
  <br><br>
  <div align="center">
    <img width="48%" alt="CLI Output Process" src="https://github.com/user-attachments/assets/4ddac3f6-6df1-490a-9d79-ff342f4009cc" />
    <img width="48%" alt="RTX 4090 GPU Utilization" src="https://github.com/user-attachments/assets/4c1794c6-5679-40fc-a29d-b20ff99c7f8a" />
    <p><i>Left: CLI process output. Right: GPU VRAM usage during generation.</i></p>
  </div>
</details>

<details>
  <summary><b> 3. Standardization & Upscaling Workflow</b></summary>
  <br>
  All generated and raw videos were standardized to 720p using a specific ComfyUI upscaling workflow to ensure consistent quality across the dataset. This setup was adapted from educational resources.
  <br><br>
  <div align="center">
    <a href="https://www.youtube.com/watch?v=BE-Af_kwhyA">
      <p>YouTube source link.</p>
    </a>
    <img width="100%" alt="Upscaler Workflow" src="https://github.com/user-attachments/assets/394ce15d-c67e-4959-b50b-544f0d652609" />
    <p><i>Figure: The upscaling and resizing node setup used for standardization.</i></p>
  </div>
</details>

---

## Project Roadmap & Timeline

### Week 0: Concept & Planning
Alignment of the core concept, definition of research objectives and scope, planning of work phases, and creation of a comprehensive action plan.

### Weeks 1 – 3: Research & Methodology
* **State of the Art:** Investigation into generative AI video models, covering typology, accessibility, and system requirements.
* **Methodology Design:** Development of the study structure, organization, interface requirements, and variable definitions.
* **Technical Feasibility:** Analysis of watermarking techniques and experimental removal attempts.

### Weeks 4 – 7: Development & Local Testing
* **ComfyUI Workflow:** Installation, onboarding, and local deployment of Wan 2.2 and Hunyuan 1.5 models.
* **Iterative Generation:** Adoption of a trial-and-error approach to achieve photorealistic results, focusing on prompt engineering and parameter optimization.
* **Technical Testing:** Research into maximum video duration and mitigation of slow-motion artifacts.
* **UI Development:** Creation of the evaluation web app interface.
* **Pre-testing:** Conducted initial pilot tests with a small group to gather feedback for UI and content refinement.
* **Scripting:** Development of a video cropping script.

### Weeks 8 – 9: Content Refinement & Standardization
* **Online Models:** Accessed paid models (e.g., Sora 2, Veo 3.1) within usage limits to expand the dataset.
* **Curation:** Selection of the highest quality generations and sourcing of complementary real-world footage.
* **Post-processing:** Color correction applied to oversaturated raw outputs; standardization of all videos to 720p using a ComfyUI-based upscaler.
* **Finalization:** Completion of the web app development, ensuring strict adherence to **ITU-R BT.500** color guidelines.

### Weeks 10 – 11: Deployment & Distribution
* **Cloud Deployment:** Deployed the Web App and MySQL Server on **Microsoft Azure** (via Azure for Students).
* **Infrastructure:** Overcame technical challenges related to the complexity of the cloud environment.
* **Launch:** Disseminated the access link among university students to facilitate the study execution.

### Week 12: Data Analysis
* **Data Collection:** The study concluded after a four-day period (Friday–Monday).
* **Processing:** The results database was exported, and a preliminary statistical analysis was performed.

---

## Study Conclusions

**Participant Demographics:** 120 participants (Aged 18–24).

### Results Overview
Presented below are the aggregate results for each individual sequence. Participants were tasked with assessing the realism of each sequence on a scale ranging from **'0% AI'** to **'100% Real'**.
* **1** on the chart corresponds to **0% AI** (Perceived as Artificial).
* **5** on the chart corresponds to **100% Real** (Perceived as Authentic).

<div align="center">
  <img width="100%" alt="all_distributions" src="https://github.com/user-attachments/assets/0c8bd4ba-baf4-435c-b3b2-4c30127b48ec" />
  <p><i>Figure 1: Distribution of user ratings across all 27 video sequences.</i></p>
</div>

### Outlier Detection
Participant analysis and the screening of outliers were conducted based on **ITU-R BT.500** recommendations.

<div align="center">
  <img width="48%" alt="Charts" src="https://github.com/user-attachments/assets/0259ea47-104c-4e48-8175-26aad96d2f25" />
  <img width="48%" alt="Outliers" src="https://github.com/user-attachments/assets/36449e76-9680-445f-bd5d-b168b65cb739" />
  <p><i>Figure 2: Statistical analysis (left) and outlier detection process (right).</i></p>
</div>

### Key Findings
The collected data indicates a **varied ability** among young adults to distinguish between AI-generated and real footage:
1.  **Detection of Artifacts:** Observers successfully identified obvious artifacts in lower-quality generations.
2.  **High-Fidelity Deception:** Advanced models frequently deceived viewers, blurring the line between synthetic and authentic content.
3.  **The "Real" Paradox:** The results reveal instances where high-quality real-world footage was misclassified as artificial.

*A more in-depth statistical analysis of these anomalies and specific video attributes will be conducted in the full report.*
