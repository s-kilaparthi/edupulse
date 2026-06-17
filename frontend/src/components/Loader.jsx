export default function Loader({ size = 60 }) {
  return (
    <div className="flex items-center justify-center">
      <img
        src="/protractor-spinner.png"
        alt="Loading..."
        width={size}
        height={size}
        style={{
          animation: 'spin 1.5s linear infinite',
        }}
      />
    </div>
  )
}
