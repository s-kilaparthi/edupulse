import { useEffect, useState } from "react"

export default function App() {
  const [status, setStatus] = useState("checking...")
  const [color, setColor] = useState("orange")

  useEffect(() => {
    fetch("http://localhost:8000/health")
      .then(r => r.json())
      .then(d => {
        setStatus(d.status)
        setColor("green")
      })
      .catch(() => {
        setStatus("error — is backend running?")
        setColor("red")
      })
  }, [])

  return (
    <div style={{padding:"40px", fontFamily:"sans-serif"}}>
      <h1 style={{fontSize:"28px", marginBottom:"8px"}}>EduPulse</h1>
      <p style={{color:"gray", marginBottom:"24px"}}>Week 1 Day 1 — Pipeline check</p>
      <div style={{display:"flex", alignItems:"center", gap:"10px"}}>
        <div style={{width:"12px", height:"12px", borderRadius:"50%", background:color}}></div>
        <span>Backend: <strong>{status}</strong></span>
      </div>
      {color === "green" && (
        <p style={{marginTop:"24px", color:"green", fontSize:"18px"}}>
          ✓ React → FastAPI pipeline working!
        </p>
      )}
    </div>
  )
}
