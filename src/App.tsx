
import { useState } from 'react'
import './App.css'

type Analysis = {
  claim: string
  date: string
}

function App() {
  const [claim, setClaim] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [history, setHistory] = useState<Analysis[]>([])
  const [activeTab, setActiveTab] = useState('Analyze')

  function handleAnalyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedClaim = claim.trim()
    if (!trimmedClaim) return

    const item = {
      claim: trimmedClaim,
      date: new Date().toLocaleString(),
    }

    setAnalysis(item)
    setHistory((previous) => [item, ...previous])
    setActiveTab('Analyze')
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setActiveTab('Analyze')}>
          <span className="brand-mark">N</span>
          <span>NewsSearch</span>
        </a>

        <p className="sidebar-label">WORKSPACE</p>

        {['Analyze', 'History', 'Notifications'].map((tab) => (
          <button
            className={`nav-item ${activeTab === tab ? 'active' : ''}`}
            key={tab}
            onClick={() => setActiveTab(tab)}
          >
            <span className="nav-symbol">
              {tab === 'Analyze' ? '⌕' : tab === 'History' ? '◷' : '♧'}
            </span>
            {tab}
            {tab === 'Notifications' && <span className="nav-count">0</span>}
          </button>
        ))}

        <div className="sidebar-bottom">
          <span className="status-dot" />
          Local development
          <p>Hybrid fake news analysis</p>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <span className="breadcrumb">Workspace / {activeTab}</span>
          <span className="account-label">NS</span>
        </header>

        <div className="content">
          {activeTab === 'Analyze' && (
            <>
              <div className="eyebrow">INFORMATION CHECKING WORKSPACE</div>
              <h1>Look closer.<br />Understand the evidence.</h1>
              <p className="intro">
                Examine a claim with machine-learning analysis and discover
                independent fact-checks and news sources.
              </p>

              <form className="claim-form" onSubmit={handleAnalyze}>
                <label htmlFor="claim">What would you like to investigate?</label>
                <textarea
                  id="claim"
                  value={claim}
                  onChange={(event) => setClaim(event.target.value)}
                  placeholder="Paste a headline, statement, or news claim..."
                  rows={5}
                  required
                />
                <div className="form-footer">
                  <span>Review claims critically. Check the sources.</span>
                  <button className="primary-button" type="submit">
                    Analyze claim <span aria-hidden="true">→</span>
                  </button>
                </div>
              </form>

              {analysis && (
                <section className="results">
                  <div className="result-heading">
                    <div>
                      <div className="eyebrow">YOUR SUBMISSION</div>
                      <h2>Claim received</h2>
                    </div>
                    <span className="demo-badge">Demo mode</span>
                  </div>
                  <blockquote>{analysis.claim}</blockquote>
                  <div className="result-grid">
                    <article className="result-card">
                      <span className="card-number">01</span>
                      <h3>ML prediction</h3>
                      <p>
                        No prediction available yet. Connect the Python
                        machine-learning API to analyze this claim.
                      </p>
                    </article>
                    <article className="result-card">
                      <span className="card-number">02</span>
                      <h3>External evidence</h3>
                      <p>
                        No sources retrieved yet. Connect fact-checking and
                        news discovery providers to investigate the claim.
                      </p>
                    </article>
                  </div>
                </section>
              )}

              {!analysis && (
                <section className="how-section">
                  <div className="eyebrow">TWO DISTINCT TRACKS</div>
                  <h2>Prediction is not proof.</h2>
                  <div className="feature-grid">
                    <article>
                      <span className="feature-icon">01</span>
                      <h3>Machine learning</h3>
                      <p>A model-based assessment, with limitations made clear.</p>
                    </article>
                    <article>
                      <span className="feature-icon">02</span>
                      <h3>Evidence discovery</h3>
                      <p>Independent sources, dates, publishers, and review findings.</p>
                    </article>
                  </div>
                </section>
              )}
            </>
          )}

          {activeTab === 'History' && (
            <>
              <div className="eyebrow">YOUR WORKSPACE</div>
              <h1>Analysis history</h1>
              <p className="intro">Claims submitted during this browser session.</p>
              {history.length === 0 ? (
                <div className="empty-state">No analyses yet. Start by submitting a claim.</div>
              ) : (
                <div className="history-list">
                  {history.map((item, index) => (
                    <button
                      className="history-item"
                      key={`${item.date}-${index}`}
                      onClick={() => {
                        setAnalysis(item)
                        setClaim(item.claim)
                        setActiveTab('Analyze')
                      }}
                    >
                      <span>{item.claim}</span>
                      <small>{item.date}</small>
                    </button>
                  ))}
                  <button className="text-button" onClick={() => setHistory([])}>
                    Clear session history
                  </button>
                </div>
              )}
              <p className="notice">
                This temporary history is stored only in page memory, not in a
                secure account or database.
              </p>
            </>
          )}

          {activeTab === 'Notifications' && (
            <>
              <div className="eyebrow">UPDATES</div>
              <h1>Notifications</h1>
              <div className="empty-state">
                No notifications yet. Notification delivery is not connected.
              </div>
            </>
          )}

          <footer className="footer">
            <span>NewsSearch · Early development</span>
            <div>
              <a href="#terms" onClick={(e) => {
                e.preventDefault()
                alert('Terms of Service will be added before public launch.')
              }}>Terms</a>
              <a href="#privacy" onClick={(e) => {
                e.preventDefault()
                alert('Privacy Policy will be added before public launch.')
              }}>Privacy</a>
            </div>
          </footer>
        </div>
      </section>
    </main>
  )
}

export default App
