(module
  (func $getFrLen (result i32)
    i32.const 32
  )
  (func $getRawPrime (result i32)
    i32.const 1
  )
  (memory (export "memory") 1)
  (export "getFrLen" (func $getFrLen))
  (export "getRawPrime" (func $getRawPrime))
)