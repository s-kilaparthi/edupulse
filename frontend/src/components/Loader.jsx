export default function Loader({ size = 40 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: size * 0.12, alignItems: 'flex-start', width: size * 1.8 }}>
      <div style={{
        height: size * 0.14,
        borderRadius: size * 0.1,
        backgroundColor: '#22C55E',
        animation: 'loadBar 1.2s ease-in-out infinite',
        animationDelay: '0s',
        width: '100%'
      }}/>
      <div style={{
        height: size * 0.14,
        borderRadius: size * 0.1,
        backgroundColor: '#FACC15',
        animation: 'loadBar 1.2s ease-in-out infinite',
        animationDelay: '0.25s',
        width: '100%'
      }}/>
      <div style={{
        height: size * 0.14,
        borderRadius: size * 0.1,
        backgroundColor: '#EF4444',
        animation: 'loadBar 1.2s ease-in-out infinite',
        animationDelay: '0.5s',
        width: '100%'
      }}/>
    </div>
  )
}
