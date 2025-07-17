import fs from 'fs/promises';
import path from 'path';
import {
	processImageReplaceBlackAndThicken,
	processImageWithJimpWhiteBackground,
	processImageWithJimpBlackBackground,
} from '../src/image';

// Mock the Gemini API for testing
class MockGeminiAPI {
	private responses: { [key: string]: string } = {
		// Add some mock responses for testing
		default: '123456',
		'jimp-white-background': '234567',
		'jimp-black-background': '345678',
	};

	async generateContent(_params: any): Promise<{ text: string }> {
		// Simulate API delay
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Return mock response based on method or default
		const mockResponse = this.responses['default'];
		return { text: mockResponse };
	}
}

// Simplified version of solveCaptchaWithMultipleMethods for testing
async function solveCaptchaWithMultipleMethods(
	imageData: string,
	mockMode: boolean = true
): Promise<{
	result: string;
	methodUsed: string;
	confidence: number;
	processingTime: number;
}> {
	const startTime = Date.now();

	// Extract base64 data from data URL
	const base64Data = imageData.split(',')[1];
	const imageBuffer = Buffer.from(base64Data, 'base64');

	// Mock API for testing
	const ai = mockMode ? new MockGeminiAPI() : null;

	// Try multiple preprocessing approaches
	const preprocessingMethods = [
		{
			name: 'jimp-white-background',
			process: processImageWithJimpWhiteBackground,
		},
		{
			name: 'jimp-black-background',
			process: processImageWithJimpBlackBackground,
		},
	];

	let bestResult = null;
	let maxConfidence = 0;
	let bestMethod = '';

	for (const method of preprocessingMethods) {
		try {
			const processedBuffer = await method.process(imageBuffer);
			const processedBase64 = processedBuffer.toString('base64');

			if (mockMode && ai) {
				const result = await ai.generateContent({
					prompt: 'Convert CAPTCHA to numbers',
					image: processedBase64,
				});

				const text = result.text.trim();
				const numberMatch = text.match(/\d{6}/);

				if (numberMatch) {
					// Simple confidence check based on response
					const confidence = text === numberMatch[0] ? 1 : 0.8;
					if (confidence > maxConfidence) {
						maxConfidence = confidence;
						bestMethod = method.name;
					}
				}
			} else {
				// For non-mock mode, we can't actually call Gemini API in tests
				// So we'll just validate that processing works
				bestMethod = method.name;
				maxConfidence = 0.8;
				break;
			}
		} catch (error) {
			console.error(`Method ${method.name} failed:`, error);
		}
	}

	const processingTime = Date.now() - startTime;

	if (bestResult) {
		return {
			result: bestResult,
			methodUsed: bestMethod,
			confidence: maxConfidence,
			processingTime,
		};
	} else {
		throw new Error('Could not extract 6-digit number from CAPTCHA');
	}
}

interface ProcessingResult {
	imageName: string;
	originalSize: number;
	jimpWhiteBackgroundSize: number;
	jimpWhiteBackgroundTime: number;
	jimpBlackBackgroundSize: number;
	jimpBlackBackgroundTime: number;
	success: boolean;
	error?: string;
}

interface CaptchaTestResult {
	imageName: string;
	success: boolean;
	result?: string;
	methodUsed?: string;
	confidence?: number;
	processingTime?: number;
	error?: string;
}

async function runComprehensiveTest(): Promise<void> {
	const imagesDir = 'tests/images';
	const outputDir = 'tests/output';
	const processingResults: ProcessingResult[] = [];
	const captchaResults: CaptchaTestResult[] = [];

	// Ensure output directory exists
	await fs.mkdir(outputDir, { recursive: true });

	try {
		// Get all image files from tests/images
		const imageFiles = await fs.readdir(imagesDir);
		const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
		const validImages = imageFiles.filter((file) =>
			imageExtensions.some((ext) => file.toLowerCase().endsWith(ext))
		);

		if (validImages.length === 0) {
			console.log('No image files found in tests/images directory');
			return;
		}

		console.log('COMPREHENSIVE CAPTCHA TEST SUITE');
		console.log('='.repeat(60));
		console.log(`Found ${validImages.length} image files to test`);
		console.log('Note: Using mock Gemini API for testing');
		console.log();

		// Process each image
		for (const imageFile of validImages) {
			const imagePath = path.join(imagesDir, imageFile);
			const imageName = path.parse(imageFile).name;

			console.log(`Processing ${imageFile}...`);

			try {
				// Read image file
				const imageBuffer = await fs.readFile(imagePath);
				const originalSize = imageBuffer.length;

				// Save original
				const originalPath = path.join(outputDir, `${imageName}_original.png`);
				await fs.writeFile(originalPath, imageBuffer);

				const processingResult: ProcessingResult = {
					imageName,
					originalSize,
					jimpWhiteBackgroundSize: 0,
					jimpWhiteBackgroundTime: 0,
					jimpBlackBackgroundSize: 0,
					jimpBlackBackgroundTime: 0,
					success: true,
				};

				// Test Replace Black and Thicken
				console.log('  Replace black and thicken...');
				let startTime = Date.now();
				const replaceBlackThicken = await processImageReplaceBlackAndThicken(imageBuffer);
				let endTime = Date.now();

				// Test Jimp white background
				console.log('  Jimp white background...');
				startTime = Date.now();
				const jimpWhiteBackground = await processImageWithJimpWhiteBackground(replaceBlackThicken);
				endTime = Date.now();
				processingResult.jimpWhiteBackgroundTime = endTime - startTime;
				processingResult.jimpWhiteBackgroundSize = jimpWhiteBackground.length;

				const jimpWhiteBackgroundPath = path.join(
					outputDir,
					`${imageName}_jimp_white_background.png`
				);
				await fs.writeFile(jimpWhiteBackgroundPath, jimpWhiteBackground);
				console.log(`    Complete (${processingResult.jimpWhiteBackgroundTime}ms)`);

				// Test Jimp black background
				console.log('  Jimp black background...');
				startTime = Date.now();
				const jimpBlackBackground = await processImageWithJimpBlackBackground(replaceBlackThicken);
				endTime = Date.now();
				processingResult.jimpBlackBackgroundTime = endTime - startTime;
				processingResult.jimpBlackBackgroundSize = jimpBlackBackground.length;

				const jimpBlackBackgroundPath = path.join(
					outputDir,
					`${imageName}_jimp_black_background.png`
				);
				await fs.writeFile(jimpBlackBackgroundPath, jimpBlackBackground);
				console.log(`    Complete (${processingResult.jimpBlackBackgroundTime}ms)`);

				processingResults.push(processingResult);

				// Test CAPTCHA solver
				console.log('  Testing CAPTCHA solver...');
				const base64Data = imageBuffer.toString('base64');
				const mimeType = imageFile.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
				const dataUrl = `data:${mimeType};base64,${base64Data}`;

				try {
					const solverResult = await solveCaptchaWithMultipleMethods(dataUrl, true);

					const captchaTestResult: CaptchaTestResult = {
						imageName,
						success: true,
						result: solverResult.result,
						methodUsed: solverResult.methodUsed,
						confidence: solverResult.confidence,
						processingTime: solverResult.processingTime,
					};

					captchaResults.push(captchaTestResult);
					console.log(
						`    CAPTCHA Success: ${solverResult.result} (${
							solverResult.methodUsed
						}, ${solverResult.confidence.toFixed(2)} confidence, ${solverResult.processingTime}ms)`
					);
				} catch (error) {
					console.error(`    CAPTCHA Error: ${error}`);
					captchaResults.push({
						imageName,
						success: false,
						error: error instanceof Error ? error.message : 'Unknown error',
					});
				}

				console.log(`  ${imageFile} processing completed`);
				console.log();
			} catch (error) {
				console.error(`  Error processing ${imageFile}:`, error);
				processingResults.push({
					imageName,
					originalSize: 0,
					jimpWhiteBackgroundSize: 0,
					jimpWhiteBackgroundTime: 0,
					jimpBlackBackgroundSize: 0,
					jimpBlackBackgroundTime: 0,
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
				captchaResults.push({
					imageName,
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		}

		// Generate comprehensive report
		await generateComprehensiveReport(processingResults, captchaResults, outputDir);
	} catch (error) {
		console.error('Error reading images directory:', error);
	}
}

async function generateComprehensiveReport(
	processingResults: ProcessingResult[],
	captchaResults: CaptchaTestResult[],
	outputDir: string
): Promise<void> {
	console.log();
	console.log('COMPREHENSIVE TEST RESULTS');
	console.log('='.repeat(60));

	const successfulProcessing = processingResults.filter((r) => r.success);
	const failedProcessing = processingResults.filter((r) => !r.success);
	const successfulCaptcha = captchaResults.filter((r) => r.success);
	const failedCaptcha = captchaResults.filter((r) => !r.success);

	console.log(`Image Processing Results:`);
	console.log(`  Successful: ${successfulProcessing.length}`);
	console.log(`  Failed: ${failedProcessing.length}`);
	console.log(
		`  Success Rate: ${((successfulProcessing.length / processingResults.length) * 100).toFixed(
			1
		)}%`
	);
	console.log();

	console.log(`CAPTCHA Solver Results:`);
	console.log(`  Successful: ${successfulCaptcha.length}`);
	console.log(`  Failed: ${failedCaptcha.length}`);
	console.log(
		`  Success Rate: ${((successfulCaptcha.length / captchaResults.length) * 100).toFixed(1)}%`
	);
	console.log();

	if (successfulProcessing.length > 0) {
		console.log('Processing Performance Analysis:');
		console.log('-'.repeat(40));

		const avgJimpWhiteTime =
			successfulProcessing.reduce((sum, r) => sum + r.jimpWhiteBackgroundTime, 0) /
			successfulProcessing.length;
		const avgJimpBlackTime =
			successfulProcessing.reduce((sum, r) => sum + r.jimpBlackBackgroundTime, 0) /
			successfulProcessing.length;

		console.log(`Jimp White Background: ${avgJimpWhiteTime.toFixed(1)}ms avg`);
		console.log(`Jimp Black Background: ${avgJimpBlackTime.toFixed(1)}ms avg`);
		console.log();

		console.log('File Size Analysis:');
		console.log('-'.repeat(40));

		const avgSizes = {
			original:
				successfulProcessing.reduce((sum, r) => sum + r.originalSize, 0) /
				successfulProcessing.length,
			jimpWhite:
				successfulProcessing.reduce((sum, r) => sum + r.jimpWhiteBackgroundSize, 0) /
				successfulProcessing.length,
			jimpBlack:
				successfulProcessing.reduce((sum, r) => sum + r.jimpBlackBackgroundSize, 0) /
				successfulProcessing.length,
		};

		console.log(`Original: ${(avgSizes.original / 1024).toFixed(1)}KB avg`);
		console.log(`Jimp White Background: ${(avgSizes.jimpWhite / 1024).toFixed(1)}KB avg`);
		console.log(`Jimp Black Background: ${(avgSizes.jimpBlack / 1024).toFixed(1)}KB avg`);
		console.log();
	}

	if (successfulCaptcha.length > 0) {
		console.log('CAPTCHA Method Performance:');
		console.log('-'.repeat(40));

		const methodStats = successfulCaptcha.reduce((stats, result) => {
			const method = result.methodUsed || 'unknown';
			if (!stats[method]) {
				stats[method] = { count: 0, totalTime: 0, totalConfidence: 0 };
			}
			stats[method].count++;
			stats[method].totalTime += result.processingTime || 0;
			stats[method].totalConfidence += result.confidence || 0;
			return stats;
		}, {} as Record<string, { count: number; totalTime: number; totalConfidence: number }>);

		Object.entries(methodStats).forEach(([method, stats]) => {
			const avgTime = stats.totalTime / stats.count;
			const avgConfidence = stats.totalConfidence / stats.count;
			console.log(
				`${method}: ${stats.count} uses, ${avgTime.toFixed(1)}ms avg, ${avgConfidence.toFixed(
					2
				)} confidence avg`
			);
		});

		const avgProcessingTime =
			successfulCaptcha.reduce((sum, r) => sum + (r.processingTime || 0), 0) /
			successfulCaptcha.length;
		const avgConfidence =
			successfulCaptcha.reduce((sum, r) => sum + (r.confidence || 0), 0) / successfulCaptcha.length;

		console.log();
		console.log(`Overall CAPTCHA Performance:`);
		console.log(`   Average Processing Time: ${avgProcessingTime.toFixed(1)}ms`);
		console.log(`   Average Confidence: ${avgConfidence.toFixed(2)}`);
		console.log();
	}

	if (failedProcessing.length > 0 || failedCaptcha.length > 0) {
		console.log('Failed Tests:');
		console.log('-'.repeat(40));
		[...failedProcessing, ...failedCaptcha].forEach((test) => {
			console.log(`${test.imageName}: ${test.error}`);
		});
		console.log();
	}

	// Generate detailed report file
	const reportPath = path.join(outputDir, 'comprehensive-test-report.json');
	const report = {
		timestamp: new Date().toISOString(),
		testMode: 'comprehensive',
		summary: {
			totalImages: processingResults.length,
			processingSuccessful: successfulProcessing.length,
			processingFailed: failedProcessing.length,
			processingSuccessRate: (successfulProcessing.length / processingResults.length) * 100,
			captchaSuccessful: successfulCaptcha.length,
			captchaFailed: failedCaptcha.length,
			captchaSuccessRate: (successfulCaptcha.length / captchaResults.length) * 100,
		},
		processingResults: processingResults,
		captchaResults: captchaResults,
		performance: {
			processing:
				successfulProcessing.length > 0
					? {
							averageProcessingTimes: {
								jimpWhiteBackground:
									successfulProcessing.reduce((sum, r) => sum + r.jimpWhiteBackgroundTime, 0) /
									successfulProcessing.length,
								jimpBlackBackground:
									successfulProcessing.reduce((sum, r) => sum + r.jimpBlackBackgroundTime, 0) /
									successfulProcessing.length,
							},
							averageFileSizes: {
								original:
									successfulProcessing.reduce((sum, r) => sum + r.originalSize, 0) /
									successfulProcessing.length,
								jimpWhiteBackground:
									successfulProcessing.reduce((sum, r) => sum + r.jimpWhiteBackgroundSize, 0) /
									successfulProcessing.length,
								jimpBlackBackground:
									successfulProcessing.reduce((sum, r) => sum + r.jimpBlackBackgroundSize, 0) /
									successfulProcessing.length,
							},
					  }
					: null,
			captcha:
				successfulCaptcha.length > 0
					? {
							averageProcessingTime:
								successfulCaptcha.reduce((sum, r) => sum + (r.processingTime || 0), 0) /
								successfulCaptcha.length,
							averageConfidence:
								successfulCaptcha.reduce((sum, r) => sum + (r.confidence || 0), 0) /
								successfulCaptcha.length,
							methodDistribution: successfulCaptcha.reduce((dist, result) => {
								const method = result.methodUsed || 'unknown';
								dist[method] = (dist[method] || 0) + 1;
								return dist;
							}, {} as Record<string, number>),
					  }
					: null,
		},
	};

	await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
	console.log(`Comprehensive report saved to: ${reportPath}`);
	console.log(`Processed images saved to: ${outputDir}`);
	console.log();
	console.log('Output Files:');
	console.log('  - {name}_original.png: Original image');
	console.log('  - {name}_jimp_white_background.png: Jimp white background');
	console.log('  - {name}_jimp_black_background.png: Jimp black background');
	console.log('  - comprehensive-test-report.json: Detailed test results');
	console.log();
	console.log('Note: This test uses mock Gemini API responses.');
	console.log('   For real API testing, you would need to configure actual API keys.');
}

// Run the comprehensive test
if (require.main === module) {
	runComprehensiveTest().catch(console.error);
}

export {
	runComprehensiveTest,
	solveCaptchaWithMultipleMethods,
	processImageWithJimpWhiteBackground,
	processImageWithJimpBlackBackground,
};
