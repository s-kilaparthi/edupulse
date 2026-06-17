export default function Loader({ size = 80 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: size * 0.15, alignItems: 'flex-start', width: size * 2 }}>
      <div style={{
        height: size * 0.18,
        borderRadius: size * 0.1,
        backgroundColor: '#22C55E',
        animation: 'loadBar 1.2s ease-in-out infinite',
        animationDelay: '0s',
        width: '100%'
      }}/>
      <div style={{
        height: size * 0.18,
        borderRadius: size * 0.1,
        backgroundColor: '#FACC15',
        animation: 'loadBar 1.2s ease-in-out infinite',
        animationDelay: '0.25s',
        width: '100%'
      }}/>
      <div style={{
        height: size * 0.18,
        borderRadius: size * 0.1,
        backgroundColor: '#EF4444',
        animation: 'loadBar 1.2s ease-in-out infinite',
        animationDelay: '0.5s',
        width: '100%'
      }}/>
    </div>
  )
}
