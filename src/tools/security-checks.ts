/**
 * Enhanced Security Checks (Claude Code Pattern)
 * 
 * 23 security checks on every bash command before execution
 * Three-gate trigger architecture for sensitive operations
 * 
 * Gates:
 * 1. Pattern Detection - Identifies potentially dangerous commands
 * 2. Context Analysis - Evaluates command in context of current operation
 * 3. Risk Scoring - Assigns risk level and determines if HITL approval needed
 */

export interface SecurityCheckResult {
  passed: boolean;
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  riskScore: number; // 0-100
  triggeredChecks: string[];
  recommendation: "allow" | "warn" | "block" | "require_approval";
  reason: string;
}

export interface CommandContext {
  command: string;
  workingDirectory: string;
  agent: string;
  recentCommands: string[];
  projectFiles: string[];
}

/**
 * The 23 Security Checks (Claude Code Pattern)
 */
const SECURITY_CHECKS = {
  // Destructive Operations (Critical)
  destructive_rm: {
    pattern: /rm\s+(-[rf]+\s+)?[/~*]/,
    risk: 90,
    description: "Recursive or root-level file deletion"
  },
  destructive_format: {
    pattern: /mkfs|dd\s+if=.*of=\/dev/,
    risk: 100,
    description: "Disk formatting or low-level write"
  },
  destructive_truncate: {
    pattern: />+\s*\/dev\/|truncate.*\/dev\//,
    risk: 95,
    description: "Writing to device files"
  },

  // Network Exfiltration (High)
  network_curl_post: {
    pattern: /curl.*(-X\s+POST|-d\s+|--data)/,
    risk: 70,
    description: "HTTP POST request (potential data exfiltration)"
  },
  network_wget_output: {
    pattern: /wget.*-O.*\||wget.*>\s*\//,
    risk: 65,
    description: "wget with piped output"
  },
  network_nc_listen: {
    pattern: /nc\s+.*-l|netcat\s+.*-l/,
    risk: 80,
    description: "Network listener (potential backdoor)"
  },
  network_ssh_tunnel: {
    pattern: /ssh\s+.*-[LRD]/,
    risk: 75,
    description: "SSH tunneling"
  },
  network_scp_external: {
    pattern: /scp\s+.*@(?!localhost|127\.0\.0\.1)/,
    risk: 70,
    description: "SCP to external host"
  },

  // Privilege Escalation (Critical)
  privilege_sudo: {
    pattern: /sudo\s+/,
    risk: 85,
    description: "Sudo command execution"
  },
  privilege_su: {
    pattern: /\bsu\s+/,
    risk: 90,
    description: "Switch user command"
  },
  privilege_chmod_suid: {
    pattern: /chmod\s+.*[47][0-7]{3}|chmod\s+.*\+s/,
    risk: 95,
    description: "Setting SUID/SGID bits"
  },

  // System Modification (High)
  system_cron: {
    pattern: /crontab\s+-e|echo.*>>\s*\/etc\/cron/,
    risk: 80,
    description: "Cron job modification"
  },
  system_systemd: {
    pattern: /systemctl\s+(enable|start|restart)|systemd/,
    risk: 75,
    description: "Systemd service manipulation"
  },
  system_hosts: {
    pattern: /echo.*>>\s*\/etc\/hosts|sed.*\/etc\/hosts/,
    risk: 70,
    description: "Hosts file modification"
  },
  system_iptables: {
    pattern: /iptables|firewall-cmd/,
    risk: 85,
    description: "Firewall rule modification"
  },

  // Package Managers (Medium-High)
  package_install: {
    pattern: /apt-get\s+install|yum\s+install|npm\s+install\s+-g|pip\s+install/,
    risk: 60,
    description: "Global package installation"
  },
  package_remove: {
    pattern: /apt-get\s+remove|yum\s+remove|npm\s+uninstall\s+-g/,
    risk: 65,
    description: "Package removal"
  },

  // Code Execution (High)
  exec_eval: {
    pattern: /eval\s+|exec\s+/,
    risk: 75,
    description: "Dynamic code evaluation"
  },
  exec_download_pipe: {
    pattern: /curl.*\|\s*(bash|sh|python)|wget.*\|\s*(bash|sh|python)/,
    risk: 95,
    description: "Download and execute pattern"
  },

  // Environment Manipulation (Medium)
  env_path_modify: {
    pattern: /export\s+PATH=|PATH=/,
    risk: 55,
    description: "PATH environment modification"
  },
  env_ld_preload: {
    pattern: /LD_PRELOAD|LD_LIBRARY_PATH/,
    risk: 80,
    description: "Library preload (potential hijacking)"
  },

  // Data Access (Medium)
  data_env_dump: {
    pattern: /printenv|env\s*$|export\s*$/,
    risk: 50,
    description: "Environment variable dump"
  },
  data_history: {
    pattern: /history|cat.*bash_history/,
    risk: 45,
    description: "Command history access"
  }
};

/**
 * Gate 1: Pattern Detection
 * Checks command against all 23 security patterns
 */
function detectPatterns(command: string): {
  matches: string[];
  maxRisk: number;
} {
  const matches: string[] = [];
  let maxRisk = 0;

  for (const [checkName, check] of Object.entries(SECURITY_CHECKS)) {
    if (check.pattern.test(command)) {
      matches.push(checkName);
      maxRisk = Math.max(maxRisk, check.risk);
    }
  }

  return { matches, maxRisk };
}

/**
 * Gate 2: Context Analysis
 * Evaluates command in context of current operation
 */
function analyzeContext(
  command: string,
  context: CommandContext,
  patternMatches: string[]
): number {
  let contextRiskModifier = 0;

  // Check for command chaining (increases risk)
  if (command.includes('&&') || command.includes('||') || command.includes(';')) {
    contextRiskModifier += 10;
  }

  // Check for output redirection to sensitive locations
  if (command.match(/>\s*\/etc\/|>\s*\/usr\/|>\s*\/bin\//)) {
    contextRiskModifier += 15;
  }

  // Check for suspicious working directory
  if (context.workingDirectory === '/' || context.workingDirectory.startsWith('/etc')) {
    contextRiskModifier += 10;
  }

  // Check for repeated similar commands (potential attack pattern)
  const cmdBase = command.split(' ')[0];
  const similarCommands = context.recentCommands.filter(recent => {
    return cmdBase && recent.startsWith(cmdBase);
  });
  if (similarCommands.length > 3) {
    contextRiskModifier += 5;
  }

  // Check for commands targeting project files
  const targetsProjectFiles = context.projectFiles.some(file => 
    command.includes(file)
  );
  if (targetsProjectFiles && patternMatches.includes('destructive_rm')) {
    contextRiskModifier += 20;
  }

  return contextRiskModifier;
}

/**
 * Gate 3: Risk Scoring
 * Assigns final risk level and recommendation
 */
function scoreRisk(
  baseRisk: number,
  contextModifier: number,
  triggeredChecks: string[]
): SecurityCheckResult {
  const finalScore = Math.min(100, baseRisk + contextModifier);
  
  let riskLevel: SecurityCheckResult["riskLevel"];
  let recommendation: SecurityCheckResult["recommendation"];
  let reason: string;

  if (finalScore >= 90) {
    riskLevel = "critical";
    recommendation = "block";
    reason = "Critical security risk detected. Command blocked.";
  } else if (finalScore >= 70) {
    riskLevel = "high";
    recommendation = "require_approval";
    reason = "High security risk. Requires explicit approval.";
  } else if (finalScore >= 50) {
    riskLevel = "medium";
    recommendation = "warn";
    reason = "Medium security risk. Proceed with caution.";
  } else if (finalScore >= 30) {
    riskLevel = "low";
    recommendation = "warn";
    reason = "Low security risk detected.";
  } else {
    riskLevel = "safe";
    recommendation = "allow";
    reason = "Command appears safe.";
  }

  // Override: Always require approval for certain critical checks
  const criticalChecks = [
    'destructive_format',
    'destructive_truncate',
    'privilege_chmod_suid',
    'exec_download_pipe',
    'network_nc_listen'
  ];
  
  if (triggeredChecks.some(check => criticalChecks.includes(check))) {
    recommendation = "require_approval";
    riskLevel = "critical";
    reason = "Critical operation detected. Manual approval required.";
  }

  return {
    passed: recommendation !== "block",
    riskLevel,
    riskScore: finalScore,
    triggeredChecks,
    recommendation,
    reason
  };
}

/**
 * Main security check function
 * Runs all three gates and returns comprehensive result
 */
export function checkCommandSecurity(
  command: string,
  context: CommandContext
): SecurityCheckResult {
  // Gate 1: Pattern Detection
  const { matches, maxRisk } = detectPatterns(command);

  // If no patterns matched, command is safe
  if (matches.length === 0) {
    return {
      passed: true,
      riskLevel: "safe",
      riskScore: 0,
      triggeredChecks: [],
      recommendation: "allow",
      reason: "No security concerns detected."
    };
  }

  // Gate 2: Context Analysis
  const contextModifier = analyzeContext(command, context, matches);

  // Gate 3: Risk Scoring
  return scoreRisk(maxRisk, contextModifier, matches);
}

/**
 * Get human-readable description of triggered checks
 */
export function getCheckDescriptions(checkNames: string[]): string[] {
  return checkNames.map(name => {
    const check = SECURITY_CHECKS[name as keyof typeof SECURITY_CHECKS];
    return check ? `${name}: ${check.description}` : name;
  });
}

/**
 * Format security check result for display
 */
export function formatSecurityResult(result: SecurityCheckResult): string {
  const riskEmoji = {
    safe: "✅",
    low: "⚠️",
    medium: "⚠️",
    high: "🚨",
    critical: "🛑"
  };

  let output = `${riskEmoji[result.riskLevel]} Security Check: ${result.riskLevel.toUpperCase()}\n`;
  output += `Risk Score: ${result.riskScore}/100\n`;
  output += `Recommendation: ${result.recommendation.toUpperCase()}\n`;
  output += `Reason: ${result.reason}\n`;

  if (result.triggeredChecks.length > 0) {
    output += `\nTriggered Checks:\n`;
    const descriptions = getCheckDescriptions(result.triggeredChecks);
    descriptions.forEach(desc => {
      output += `  - ${desc}\n`;
    });
  }

  return output;
}

// Made with Bob
