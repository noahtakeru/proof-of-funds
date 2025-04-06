// Test circuit

// Custom template
template MyTest() {
    signal input a;
    signal output b;
    
    b <== a * a;
}

component main = MyTest();
