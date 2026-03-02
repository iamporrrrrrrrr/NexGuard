# Building NexGuard Documentation

## Quick Start

### Option 1: Overleaf (Recommended)
1. Go to [Overleaf](https://www.overleaf.com/)
2. Create new project → Upload Project
3. Upload `NEXGUARD_DOCUMENTATION.tex`
4. Click "Recompile" → Download PDF

### Option 2: Local LaTeX Installation

#### macOS
```bash
# Install MacTeX (large, ~4GB)
brew install --cask mactex-no-gui

# Or install BasicTeX (smaller, ~100MB)
brew install --cask basictex

# Add to PATH
export PATH="/Library/TeX/texbin:$PATH"

# Compile document
pdflatex NEXGUARD_DOCUMENTATION.tex
pdflatex NEXGUARD_DOCUMENTATION.tex  # Run twice for TOC
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install texlive-full

pdflatex NEXGUARD_DOCUMENTATION.tex
pdflatex NEXGUARD_DOCUMENTATION.tex
```

#### Windows
1. Download [MiKTeX](https://miktex.org/download)
2. Install MiKTeX
3. Open Command Prompt in project directory
4. Run: `pdflatex NEXGUARD_DOCUMENTATION.tex`

### Option 3: Docker (Cross-Platform)
```bash
# Use official LaTeX Docker image
docker run --rm -i -v "$PWD:/data" \
  blang/latex:ubuntu \
  pdflatex NEXGUARD_DOCUMENTATION.tex

# Run twice for table of contents
docker run --rm -i -v "$PWD:/data" \
  blang/latex:ubuntu \
  pdflatex NEXGUARD_DOCUMENTATION.tex
```

## Output

The compilation will generate:
- `NEXGUARD_DOCUMENTATION.pdf` — The final document (submit this)
- `NEXGUARD_DOCUMENTATION.aux` — Auxiliary file (can delete)
- `NEXGUARD_DOCUMENTATION.log` — Build log (can delete)
- `NEXGUARD_DOCUMENTATION.toc` — Table of contents data (can delete)

## Cleaning Up

```bash
# Remove auxiliary files
rm -f *.aux *.log *.toc *.out *.synctex.gz

# Keep only the PDF and .tex source
ls NEXGUARD_DOCUMENTATION.*
```

## Troubleshooting

### Missing Packages
If you get errors like "File X.sty not found":

#### MacTeX/BasicTeX
```bash
sudo tlmgr update --self
sudo tlmgr install tcolorbox listings xcolor enumitem booktabs fancyhdr titlesec
```

#### MiKTeX
Allow automatic package installation when prompted.

### Table of Contents Empty
Run `pdflatex` **twice** — first pass generates TOC data, second pass includes it.

### Unicode Errors
Ensure file encoding is UTF-8. If using Windows, save with UTF-8 encoding.

## Document Sections

The generated PDF contains:
1. **Executive Summary** — Problem, solution, key achievements
2. **System Architecture** — Tech stack, component breakdown
3. **Implementation Details** — Data flows, code examples, database schema
4. **ML Pipeline** — Training data, models, evaluation metrics
5. **Testing & Validation** — Unit tests, integration tests, benchmarks
6. **Results & Observations** — Demo scenarios, classifier accuracy, UX insights
7. **Challenges & Learnings** — Technical issues, design decisions
8. **Future Work** — Near-term, medium-term, long-term enhancements
9. **Conclusion** — Honest assessment, impact, broader implications
10. **Appendices** — File structure, setup guide, API docs, configuration

Total pages: ~30 pages of comprehensive documentation.

## Recommended for Judges

When submitting, include:
1. `NEXGUARD_DOCUMENTATION.pdf` — This document
2. `README.md` — Quick start guide
3. `ARCHITECTURE.md` — Visual system diagram
4. GitHub repository link with all source code

All claims in this document can be verified against the code submission in:
- `src/` — All Node.js backend implementation
- `ml/` — All Python ML sidecar code
- `prisma/schema.prisma` — Database schema
- `.env.example` — Required environment variables
