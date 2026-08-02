/**
 * Full-bleed safety banner (spec §3.1/§4.2): filterOn is the state most
 * likely to be glanced at, not read, so the OFF state must be visually loud
 * — looking at the sun without the filter is the one mistake this app
 * exists to prevent.
 */
function FilterBanner({ filterOn }) {
  return (
    <div
      role={filterOn ? 'status' : 'alert'}
      className={
        filterOn
          ? 'w-full bg-green-700 py-3 text-center text-xl font-bold text-white'
          : 'w-full animate-pulse bg-red-600 py-3 text-center text-2xl font-extrabold text-white'
      }
    >
      {filterOn ? 'FILTER ON' : 'FILTER OFF — DO NOT LOOK'}
    </div>
  )
}

export default FilterBanner
