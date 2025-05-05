/**
 * ZK Performance benchmarking system
 * Allows performance measurement and comparison between different ZK operations
 */

import { ZKErrorLogger } from '../zkErrorLogger.mjs';

/**
 * Represents a performance metric with a name and value
 */
interface Metric {
    name: string;
    value: number;
    unit: string;
}

/**
 * Benchmark options
 */
interface BenchmarkOptions {
    iterations?: number;
    warmupIterations?: number;
    timeout?: number;
    collectMemoryStats?: boolean;
    collectDetailedMetrics?: boolean;
    tags?: string[];
}

/**
 * Comparison result between benchmarks
 */
interface ComparisonResult {
    metricName: string;
    baseline: number;
    current: number;
    difference: number;
    percentChange: number;
    improved: boolean;
}

/**
 * PerformanceBenchmark class for measuring and comparing ZK operations performance
 */
export class PerformanceBenchmark {
    private name: string;
    private description: string;
    private metrics: Map<string, Metric> = new Map();
    private options: BenchmarkOptions;
    private startTime: number = 0;
    private endTime: number = 0;
    private logger: ZKErrorLogger;

    /**
     * Create a new performance benchmark
     * 
     * @param name - Name of the benchmark
     * @param description - Description of what is being benchmarked
     * @param options - Benchmark options
     */
    constructor(name: string, description: string, options: BenchmarkOptions = {}) {
        this.name = name;
        this.description = description;
        this.options = {
            iterations: 5,
            warmupIterations: 1,
            timeout: 60000,
            collectMemoryStats: true,
            collectDetailedMetrics: false,
            tags: [],
            ...options
        };

        // Create logger instance
        this.logger = new ZKErrorLogger({
            logLevel: 'info',
            privacyLevel: 'public'
        });

        this.logger.info('PerformanceBenchmark initialized', {
            details: {
                name: this.name,
                description: this.description,
                options: this.options
            }
        });
    }

    /**
     * Start the benchmark timer
     */
    startBenchmark(): void {
        this.startTime = performance.now();

        this.logger.info('Starting benchmark', {
            details: {
                name: this.name,
                options: this.options
            }
        });
    }

    /**
     * End the benchmark timer and calculate elapsed time
     * 
     * @returns Elapsed time in milliseconds
     */
    endBenchmark(): number {
        this.endTime = performance.now();
        const elapsedTime = this.endTime - this.startTime;

        // Record elapsed time as a metric
        this.recordMetric('totalTime', elapsedTime, 'ms');

        this.logger.info('Benchmark completed', {
            details: {
                name: this.name,
                metrics: Object.fromEntries(this.metrics),
                duration: elapsedTime
            }
        });

        return elapsedTime;
    }

    /**
     * Record a metric with a name and value
     * 
     * @param metricName - Name of the metric
     * @param value - Value of the metric
     * @param unit - Unit of measurement (default: 'ms')
     */
    recordMetric(metricName: string, value: number, unit: string = 'ms'): void {
        this.metrics.set(metricName, { name: metricName, value, unit });

        this.logger.info('Metric recorded', {
            details: {
                name: metricName,
                value,
                unit,
                benchmark: this.name
            }
        });
    }

    /**
     * Run a benchmark function for the configured number of iterations
     * 
     * @param benchmarkFn - Function to benchmark
     * @returns Average execution time in milliseconds
     */
    async runBenchmark(benchmarkFn: () => Promise<void>): Promise<number> {
        // Perform warmup iterations
        for (let i = 0; i < this.options.warmupIterations!; i++) {
            try {
                await benchmarkFn();
            } catch (error) {
                this.logger.warn('Warmup iteration failed', {
                    details: {
                        iteration: i,
                        error: error instanceof Error ? error.message : String(error)
                    }
                });
            }
        }

        this.startBenchmark();
        const times: number[] = [];

        // Run actual benchmark iterations
        for (let i = 0; i < this.options.iterations!; i++) {
            const iterationStart = performance.now();
            try {
                await benchmarkFn();
                const iterationTime = performance.now() - iterationStart;
                times.push(iterationTime);
            } catch (error) {
                this.logger.error('Benchmark iteration failed', {
                    details: {
                        iteration: i,
                        error: error instanceof Error ? error.message : String(error)
                    }
                });
            }
        }

        const totalTime = times.reduce((sum, time) => sum + time, 0);
        const averageTime = totalTime / times.length;
        this.endBenchmark();

        // Record additional statistics
        this.recordMetric('averageTime', averageTime, 'ms');
        this.recordMetric('minTime', Math.min(...times), 'ms');
        this.recordMetric('maxTime', Math.max(...times), 'ms');

        return averageTime;
    }

    /**
     * Compare this benchmark with another benchmark
     * 
     * @param otherBenchmark - Benchmark to compare with
     * @returns Comparison results for each metric
     */
    compareToBenchmark(otherBenchmark: PerformanceBenchmark): ComparisonResult[] {
        const comparisonResults: ComparisonResult[] = [];

        // Compare metrics that exist in both benchmarks
        for (const [metricName, metric] of this.metrics) {
            const otherMetric = otherBenchmark.metrics.get(metricName);
            if (otherMetric && otherMetric.unit === metric.unit) {
                const difference = metric.value - otherMetric.value;
                const percentChange = (difference / otherMetric.value) * 100;

                // For time metrics, lower is better
                const isTimeBased = ['ms', 's', 'ns'].includes(metric.unit);
                const improved = isTimeBased ? difference < 0 : difference > 0;

                comparisonResults.push({
                    metricName,
                    baseline: otherMetric.value,
                    current: metric.value,
                    difference,
                    percentChange,
                    improved
                });
            }
        }

        // Log comparison results
        const improvement = comparisonResults.filter(r => r.improved).length /
            comparisonResults.length * 100;

        this.logger.info('Benchmark comparison', {
            details: {
                currentBenchmark: this.name,
                comparedTo: otherBenchmark.name,
                improvement: `${improvement.toFixed(2)}%`,
                metrics: comparisonResults
            }
        });

        return comparisonResults;
    }

    /**
     * Get benchmark results
     * 
     * @returns All recorded metrics
     */
    getResults(): Record<string, Metric> {
        return Object.fromEntries(this.metrics);
    }

    /**
     * Get a specific metric by name
     * 
     * @param metricName - Name of the metric to retrieve
     * @returns The metric value or undefined if not found
     */
    getMetric(metricName: string): Metric | undefined {
        return this.metrics.get(metricName);
    }

    /**
     * Calculate standard deviation of array of numbers
     * 
     * @param values - Array of numbers
     * @returns Standard deviation
     */
    private calculateStdDev(values: number[]): number {
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squareDiffs = values.map(value => {
            const diff = value - avg;
            return diff * diff;
        });
        const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / squareDiffs.length;
        return Math.sqrt(avgSquareDiff);
    }
} 