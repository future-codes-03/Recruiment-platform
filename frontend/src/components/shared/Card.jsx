function Card({ children, className = '', padded = true }) {
  return (
    <div
      className={`bg-card rounded-xl shadow-[0_2px_10px_rgba(28,37,52,0.08)] ${
        padded ? 'p-6' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

export default Card
